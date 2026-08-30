/**
 * 内嵌登录的纯逻辑（无 chrome 依赖）。
 * 独立成文件以便根目录 Vitest 测试引用——网站的 tsconfig 排除 chrome-extension，
 * 但被 import 的文件仍会进入网站类型检查程序，故本文件不得引用 chrome 全局。
 */
import type { CrowAuth } from './crow-session-types';

export type InlineLoginInput = {
  email: string;
  password: string;
};

export type InlineLoginOk = {
  ok: true;
  auth: CrowAuth;
};

export type InlineLoginFail = {
  ok: false;
  message: string;
};

export type InlineLoginResult = InlineLoginOk | InlineLoginFail;

/** 登录成功后组装 CrowAuth（siteOrigin 作为 apiBaseUrl 默认值）。 */
export function buildCrowAuthFromLogin(
  result: { access_token: string; refresh_token: string; expires_at: number },
  opts: { siteOrigin: string; supabaseUrl: string; supabaseAnonKey: string }
): CrowAuth {
  return {
    apiBaseUrl: opts.siteOrigin.trim().replace(/\/+$/, ''),
    accessToken: result.access_token,
    refreshToken: result.refresh_token,
    supabaseUrl: opts.supabaseUrl.trim().replace(/\/+$/, ''),
    supabaseAnonKey: opts.supabaseAnonKey.trim(),
    expiresAt: result.expires_at,
  };
}
