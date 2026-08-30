import { describe, expect, it } from 'vitest';
import { buildCrowAuthFromLogin } from '../chrome-extension/src/lib/crow-auth-build';

describe('buildCrowAuthFromLogin', () => {
  it('组装 CrowAuth 并规范化 origin / url / anon', () => {
    const auth = buildCrowAuthFromLogin(
      { access_token: 'at', refresh_token: 'rt', expires_at: 123 },
      {
        siteOrigin: 'https://crow.example.com/',
        supabaseUrl: 'https://sb.example.co/',
        supabaseAnonKey: ' anon ',
      }
    );
    expect(auth).toEqual({
      apiBaseUrl: 'https://crow.example.com',
      accessToken: 'at',
      refreshToken: 'rt',
      supabaseUrl: 'https://sb.example.co',
      supabaseAnonKey: 'anon',
      expiresAt: 123,
    });
  });
});
