import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';
import { POST } from '@/app/api/explain/tag/route';
import { classifyCategory } from '@/lib/ai/classify';
import { checkRateLimit, getClientIp } from '@/lib/request-guard';

/**
 * 回归：/api/explain/tag 无鉴权，且每个请求都会真实触发一次 AI 调用。
 * 原实现既不限流也不计入预算，任何人可循环 POST 直接烧 provider 额度。
 */
vi.mock('@/lib/ai/classify', () => ({
  USER_LLM_CONFIG_HEADER: 'x-crow-llm-config',
  classifyCategory: vi.fn(),
}));

vi.mock('@/lib/request-guard', () => ({
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn(() => '1.2.3.4'),
}));

const mockedClassify = vi.mocked(classifyCategory);
const mockedRate = vi.mocked(checkRateLimit);
const mockedIp = vi.mocked(getClientIp);

function postReq(body: unknown, ip = '1.2.3.4'): NextRequest {
  mockedIp.mockReturnValue(ip);
  return new Request('https://site.example/api/explain/tag', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

beforeEach(() => {
  mockedClassify.mockReset();
  mockedRate.mockReset();
  mockedRate.mockResolvedValue({ ok: true, retryAfterSec: 0, backend: 'memory' });
});

describe('POST /api/explain/tag 限流', () => {
  it('限流命中：返回 429 + Retry-After，且不进 AI 调用', async () => {
    mockedRate.mockResolvedValue({ ok: false, retryAfterSec: 42, backend: 'memory' });

    const res = await POST(postReq({ inputText: 'TCP' }));

    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('42');
    expect(mockedClassify).not.toHaveBeenCalled();
  });

  it('限流按 explain-tag 作用域 + 客户端 IP 计数', async () => {
    mockedClassify.mockResolvedValue('计算机网络');

    await POST(postReq({ inputText: 'TCP' }, '9.9.9.9'));

    expect(mockedRate).toHaveBeenCalledWith(
      'explain-tag',
      '9.9.9.9',
      expect.any(Number),
      expect.any(Number)
    );
  });

  it('未限流时正常返回分类词', async () => {
    mockedClassify.mockResolvedValue('计算机网络');

    const res = await POST(postReq({ inputText: 'TCP 三次握手', explanation: '建立连接的过程' }));
    const body = (await res.json()) as { data?: { tag?: string | null } };

    expect(res.status).toBe(200);
    expect(body.data?.tag).toBe('计算机网络');
    expect(mockedClassify).toHaveBeenCalledWith(
      expect.objectContaining({ inputText: 'TCP 三次握手', explanation: '建立连接的过程' })
    );
  });

  it('缺少 inputText 时 400，且不浪费 AI 调用', async () => {
    const res = await POST(postReq({ explanation: '没有输入' }));

    expect(res.status).toBe(400);
    expect(mockedClassify).not.toHaveBeenCalled();
  });
});
