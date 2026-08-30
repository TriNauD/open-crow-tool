import { describe, expect, it } from 'vitest';
import { POST } from '@/app/api/feishu/events/route';

describe('feishu events stub', () => {
  it('POST 返回 501 与 FEISHU_NOT_ENABLED', async () => {
    const res = await POST();
    expect(res.status).toBe(501);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe('FEISHU_NOT_ENABLED');
  });
});
