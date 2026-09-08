import { beforeEach, describe, expect, it, vi } from 'vitest';
import { classifyCategory, CLASSIFY_TIMEOUT_MS } from '@/lib/ai/classify';

/**
 * 回归：#50 引入的总结分类最初直接裸调 provider，没有超时也没有 signal，
 * 主通道一挂起就会拖满 SDK 默认 10 分钟，fallback 链永不切换。
 */
vi.mock('@/lib/ai/providers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai/providers')>();
  return {
    ...actual,
    USER_LLM_CONFIG_HEADER: 'x-crow-llm-config',
    parseUserLLMConfig: vi.fn(async () => null),
    getProviderTimeoutMs: vi.fn(() => 60),
    getProviderChain: vi.fn(),
  };
});

const { getProviderChain } = await import('@/lib/ai/providers');
const mockedChain = vi.mocked(getProviderChain);

type CreateOpts = { signal?: AbortSignal } | undefined;

/** 挂起型 provider：只有被 abort 才 reject（模拟「连上但不返回」） */
function hangingClient() {
  const calls: CreateOpts[] = [];
  const client = {
    chat: {
      completions: {
        create: (_body: unknown, opts: CreateOpts) => {
          calls.push(opts);
          return new Promise<never>((_resolve, reject) => {
            opts?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
          });
        },
      },
    },
  };
  return { client, calls };
}

function okClient(tag: string) {
  const client = {
    chat: {
      completions: {
        create: () => Promise.resolve({ choices: [{ message: { content: tag } }] }),
      },
    },
  };
  return client;
}

beforeEach(() => {
  mockedChain.mockReset();
});

describe('classifyCategory 超时与 fallback', () => {
  it('第一家挂起时按时 abort 并切到下一家，拿到分类词', async () => {
    const hang = hangingClient();
    mockedChain.mockReturnValue([
      { name: 'custom', client: hang.client, model: 'm1' },
      { name: 'siliconflow', client: okClient('计算机网络'), model: 'm2' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    const start = Date.now();
    const tag = await classifyCategory({ inputText: 'TCP 三次握手' });

    expect(tag).toBe('计算机网络');
    // 挂起那家确实被下发了 signal，且 abort 触发（不是靠 SDK 默认 10 分钟超时）
    expect(hang.calls[0]?.signal).toBeDefined();
    expect(hang.calls[0]?.signal?.aborted).toBe(true);
    expect(Date.now() - start).toBeLessThan(2_000);
  });

  it('全链挂起时返回 null，且总耗时被超时预算兜住', async () => {
    const a = hangingClient();
    const b = hangingClient();
    mockedChain.mockReturnValue([
      { name: 'a', client: a.client, model: 'm1' },
      { name: 'b', client: b.client, model: 'm2' },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ] as any);

    const start = Date.now();
    const tag = await classifyCategory({ inputText: 'TCP' });

    expect(tag).toBeNull();
    expect(a.calls).toHaveLength(1);
    expect(b.calls).toHaveLength(1);
    expect(Date.now() - start).toBeLessThan(2_000);
  });

  it('分类超时上限收敛在 8s，不会串满整条 fallback 链', () => {
    expect(CLASSIFY_TIMEOUT_MS).toBe(8_000);
  });
});
