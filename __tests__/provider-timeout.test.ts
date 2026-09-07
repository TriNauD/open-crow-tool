import { afterEach, describe, expect, it } from 'vitest';
import {
  getProviderTimeoutMs,
  isProviderTimeoutError,
  runProviderChain,
  withProviderTimeout,
  type ProviderChainEntry,
} from '@/lib/ai/providers';

/** 永不 resolve 的挂起 promise，模拟主通道 hang 住 */
function hangingFn(onSignal?: (signal: AbortSignal) => void) {
  return (signal: AbortSignal) =>
    new Promise<never>((_resolve, reject) => {
      onSignal?.(signal);
      signal.addEventListener('abort', () => reject(new Error('aborted by signal')));
    });
}

describe('getProviderTimeoutMs', () => {
  const KEY = 'AI_PROVIDER_TIMEOUT_MS';

  afterEach(() => {
    delete process.env[KEY];
  });

  it('默认 18s；非法值回退默认；合法环境变量生效', () => {
    expect(getProviderTimeoutMs()).toBe(18_000);
    process.env[KEY] = 'not-a-number';
    expect(getProviderTimeoutMs()).toBe(18_000);
    process.env[KEY] = '-5';
    expect(getProviderTimeoutMs()).toBe(18_000);
    process.env[KEY] = '9000';
    expect(getProviderTimeoutMs()).toBe(9_000);
  });
});

describe('withProviderTimeout', () => {
  it('及时 resolve 则原样返回，不抛错', async () => {
    const value = await withProviderTimeout(1_000, async () => 'ok');
    expect(value).toBe('ok');
  });

  it('fn 自身报错时透传原错误（不误标为超时）', async () => {
    const err = await withProviderTimeout(1_000, async () => {
      throw new Error('401 unauthorized');
    }).catch((e) => e);
    expect(err.message).toBe('401 unauthorized');
    expect(isProviderTimeoutError(err)).toBe(false);
  });

  it('挂起的调用在超时后被中断，抛出带超时标记的错误', async () => {
    let aborted = false;
    const start = Date.now();
    const err = await withProviderTimeout(30, hangingFn((signal) => {
      signal.addEventListener('abort', () => { aborted = true; });
    })).catch((e) => e);

    expect(aborted).toBe(true);
    expect(Date.now() - start).toBeLessThan(2_000);
    expect(err).toBeInstanceOf(Error);
    expect(String(err.message)).toContain('内未响应');
    expect(isProviderTimeoutError(err)).toBe(true);
  });

  it('resolve 后不再计时（流式输出可以比超时更久）', async () => {
    // 连接阶段立即完成，之后「流式消费」耗时超过原超时窗
    const value = await withProviderTimeout(20, async (signal) => ({ signal }));
    await new Promise((r) => setTimeout(r, 80));
    expect(value.signal.aborted).toBe(false);
  });
});

describe('runProviderChain', () => {
  const chain: ProviderChainEntry[] = [
    { name: 'a', client: {} as ProviderChainEntry['client'], model: 'm-a' },
    { name: 'b', client: {} as ProviderChainEntry['client'], model: 'm-b' },
  ];

  it('第一个成功即返回，携带 provider 名', async () => {
    const res = await runProviderChain(chain, (e) => Promise.resolve(`ok:${e.name}`));
    expect(res).toEqual({ value: 'ok:a', providerName: 'a' });
  });

  it('前一家失败自动切下一家；onProviderError 收到每次失败', async () => {
    const failures: string[] = [];
    const res = await runProviderChain(
      chain,
      (e) => {
        if (e.name === 'a') throw new Error('boom');
        return Promise.resolve('ok:b');
      },
      (name) => failures.push(name)
    );
    expect(res).toEqual({ value: 'ok:b', providerName: 'b' });
    expect(failures).toEqual(['a']);
  });

  it('全部失败时抛出最后一个错误', async () => {
    const err = await runProviderChain(chain, (e) => {
      throw new Error(`fail-${e.name}`);
    }).catch((e) => e);
    expect(err.message).toBe('fail-b');
  });

  it('空链抛出兜底错误', async () => {
    const err = await runProviderChain([], () => Promise.resolve('x')).catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toContain('All AI providers failed');
  });

  it('与 withProviderTimeout 组合：挂起的 provider 超时后切到下一家', async () => {
    const res = await runProviderChain(
      chain,
      (e) => {
        if (e.name === 'a') return withProviderTimeout(30, hangingFn());
        return withProviderTimeout(1_000, async () => 'ok:b');
      }
    );
    expect(res.value).toBe('ok:b');
    expect(res.providerName).toBe('b');
  });
});
