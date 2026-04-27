import { describe, expect, it } from 'vitest';
import { corsHeaders, handleOptions } from '@/lib/utils/cors';

describe('CORS（扩展 / 跨域 Bearer）', () => {
  it('Access-Control-Allow-Headers 包含 Authorization，满足带 Bearer 的预检', () => {
    const h = corsHeaders['Access-Control-Allow-Headers'];
    expect(h).toContain('Authorization');
    expect(h).toContain('Content-Type');
  });

  it('OPTIONS 预检响应携带与 API 一致的 corsHeaders', () => {
    const res = handleOptions();
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
  });
});
