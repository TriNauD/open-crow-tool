/**
 * 卡片 / Popup 内嵌登录的共享逻辑。
 * 与 refresh 相同的双通道策略：优先经 background SW 调 GoTrue（避开第三方页面
 * 的 CSP / Origin 差异），SW 不可用时再由当前上下文直连兜底。
 */
import type { CrowAuth } from './crow-session';
import { getBuildSiteOrigin, getBuildSupabasePublic, persistCrowAuth } from './crow-session';
import { performSupabasePasswordLogin, type SupabasePasswordLoginResult } from './supabase-password-login';

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

function passwordLoginViaBackground(
  supabaseUrl: string,
  supabaseAnonKey: string,
  email: string,
  password: string
): Promise<SupabasePasswordLoginResult | null> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(
        {
          type: 'CROW_PASSWORD_LOGIN',
          supabaseUrl,
          supabaseAnonKey,
          email,
          password,
        },
        (response: unknown) => {
          if (chrome.runtime.lastError) {
            resolve(null);
            return;
          }
          const r = response as
            | {
                ok: true;
                access_token: string;
                refresh_token: string;
                expires_at: number;
              }
            | { ok: false; message: string }
            | undefined;
          if (!r) {
            resolve(null);
            return;
          }
          if (r.ok) {
            resolve({
              ok: true,
              access_token: r.access_token,
              refresh_token: r.refresh_token,
              expires_at: r.expires_at,
            });
          } else {
            resolve({ ok: false, message: r.message });
          }
        }
      );
    } catch {
      resolve(null);
    }
  });
}

/** 内嵌登录并持久化会话；成功后调用方无需再写 storage（storage.onChanged 会广播）。 */
export async function loginAndPersist(input: InlineLoginInput): Promise<InlineLoginResult> {
  const { url, anonKey } = getBuildSupabasePublic();
  const siteOrigin = getBuildSiteOrigin();

  const viaBg = await passwordLoginViaBackground(url, anonKey, input.email, input.password);
  const result = viaBg ?? (await performSupabasePasswordLogin(url, anonKey, input.email, input.password));

  if (!result.ok) {
    return { ok: false, message: result.message };
  }

  const auth = buildCrowAuthFromLogin(result, {
    siteOrigin,
    supabaseUrl: url,
    supabaseAnonKey: anonKey,
  });
  await persistCrowAuth(auth);
  return { ok: true, auth };
}
