import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkRateLimit,
  getClientIp,
  isOriginAllowed,
  resetRateLimitMemory,
} from '@/lib/request-guard';

function makeReq(headers: Record<string, string>, url = 'https://opencrow.example/api/explain'): Request {
  return new Request(url, { method: 'POST', headers });
}

const GUARD_ENV_KEYS = [
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
] as const;

describe('getClientIp', () => {
  it('x-forwarded-for 取第一个 IP（Vercel 可能带逗号列表）', () => {
    const req = makeReq({ 'x-forwarded-for': '1.2.3.4, 10.0.0.1' });
    expect(getClientIp(req)).toBe('1.2.3.4');
  });

  it('无 forwarded 时退回 x-real-ip，再退 unknown', () => {
    expect(getClientIp(makeReq({ 'x-real-ip': '5.6.7.8' }))).toBe('5.6.7.8');
    expect(getClientIp(makeReq({}))).toBe('unknown');
  });
});

describe('isOriginAllowed（纵深防御）', () => {
  it('无 Origin 放行（curl / 服务端直连，交给限流管）', () => {
    expect(isOriginAllowed(makeReq({}))).toBe(true);
  });

  it('同源与 chrome-extension:// 放行', () => {
    expect(isOriginAllowed(makeReq({ origin: 'https://opencrow.example' }))).toBe(true);
    expect(isOriginAllowed(makeReq({ origin: 'chrome-extension://abcdefg' }))).toBe(true);
  });

  it('第三方网页 Origin 拒绝', () => {
    expect(isOriginAllowed(makeReq({ origin: 'https://evil.example' }))).toBe(false);
    expect(isOriginAllowed(makeReq({ origin: 'not-a-url' }))).toBe(false);
  });
});

describe('checkRateLimit（内存兜底）', () => {
  beforeEach(() => {
    resetRateLimitMemory();
    for (const k of GUARD_ENV_KEYS) delete process.env[k];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('窗口内超过上限被拒，带 Retry-After；不同 IP 互不影响', async () => {
    const first = await checkRateLimit('explain', '1.1.1.1', 2, 60_000);
    expect(first).toMatchObject({ ok: true, backend: 'memory' });
    expect((await checkRateLimit('explain', '1.1.1.1', 2, 60_000)).ok).toBe(true);
    const denied = await checkRateLimit('explain', '1.1.1.1', 2, 60_000);
    expect(denied.ok).toBe(false);
    expect(denied.retryAfterSec).toBeGreaterThan(0);
    expect((await checkRateLimit('explain', '2.2.2.2', 2, 60_000)).ok).toBe(true);
  });

  it('scope 隔离：explain 与 fetch-url 各算各的', async () => {
    await checkRateLimit('explain', '1.1.1.1', 1, 60_000);
    expect((await checkRateLimit('explain', '1.1.1.1', 1, 60_000)).ok).toBe(false);
    expect((await checkRateLimit('fetch-url', '1.1.1.1', 1, 60_000)).ok).toBe(true);
  });

  it('窗口重置后恢复可用', async () => {
    await checkRateLimit('explain', '3.3.3.3', 1, 10);
    expect((await checkRateLimit('explain', '3.3.3.3', 1, 10)).ok).toBe(false);
    await new Promise((r) => setTimeout(r, 15));
    expect((await checkRateLimit('explain', '3.3.3.3', 1, 10)).ok).toBe(true);
  });
});

describe('checkRateLimit（Upstash）', () => {
  beforeEach(() => {
    resetRateLimitMemory();
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'upstash-token';
  });

  afterEach(() => {
    for (const k of GUARD_ENV_KEYS) delete process.env[k];
    vi.unstubAllGlobals();
  });

  it('INCR 计数超限时拒绝，首个请求附带 PEXPIRE', async () => {
    const calls: string[] = [];
    let incrCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        calls.push(url);
        if (url.includes('/incr/')) return Response.json({ result: ++incrCount });
        return Response.json({ result: 60000 });
      })
    );

    expect((await checkRateLimit('explain', '9.9.9.9', 2, 60_000)).ok).toBe(true);
    expect((await checkRateLimit('explain', '9.9.9.9', 2, 60_000)).ok).toBe(true);
    const denied = await checkRateLimit('explain', '9.9.9.9', 2, 60_000);
    expect(denied).toMatchObject({ ok: false, backend: 'upstash' });

    expect(calls.some((u) => u.includes('/pexpire/'))).toBe(true);
    expect(calls.filter((u) => u.includes('/incr/')).length).toBe(3);
  });

  it('Upstash 不可用时 fail-open 退回内存兜底', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      })
    );
    const res = await checkRateLimit('explain', '8.8.8.8', 1, 60_000);
    expect(res).toMatchObject({ ok: true, backend: 'memory' });
  });
});
