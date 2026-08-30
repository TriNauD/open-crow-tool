import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  mapPasswordLoginError,
  performSupabasePasswordLogin,
} from '../chrome-extension/src/lib/supabase-password-login';

describe('mapPasswordLoginError', () => {
  it('映射凭据错误', () => {
    expect(mapPasswordLoginError('Invalid login credentials')).toContain('邮箱或密码不正确');
  });

  it('映射未验证邮箱', () => {
    expect(mapPasswordLoginError('Email not confirmed')).toContain('尚未验证');
  });

  it('映射限流', () => {
    expect(mapPasswordLoginError('rate limit exceeded', 429)).toContain('过于频繁');
  });

  it('映射 5xx 为可读提示', () => {
    expect(mapPasswordLoginError('HTTP 502', 502)).toContain('登录服务暂时不可用');
    expect(mapPasswordLoginError('', 503)).toContain('登录服务暂时不可用');
  });

  it('映射网络失败', () => {
    expect(mapPasswordLoginError('Failed to fetch', 0)).toContain('网络异常');
  });
});

describe('performSupabasePasswordLogin', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('缺少配置时返回可读错误', async () => {
    const r = await performSupabasePasswordLogin('', '', 'a@b.com', 'x');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain('未配置');
  });

  it('成功时返回 token 字段', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access_token: 'at',
          refresh_token: 'rt',
          expires_in: 3600,
        }),
      })
    );
    const r = await performSupabasePasswordLogin(
      'https://example.supabase.co',
      'anon',
      'a@b.com',
      'secret'
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.access_token).toBe('at');
      expect(r.refresh_token).toBe('rt');
      expect(r.expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000));
    }
  });

  it('401/凭据错误返回中文提示', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error_description: 'Invalid login credentials' }),
      })
    );
    const r = await performSupabasePasswordLogin(
      'https://example.supabase.co',
      'anon',
      'a@b.com',
      'bad'
    );
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain('邮箱或密码不正确');
  });
});
