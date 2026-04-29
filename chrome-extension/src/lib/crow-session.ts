import type { SupabaseRefreshResult } from './supabase-refresh-exchange';
import { performSupabaseRefreshExchange } from './supabase-refresh-exchange';

/** Keys persisted in chrome.storage.local for site-driven connect (see content bridge). */
export const CROW_AUTH_LOCAL_KEYS = [
  'accessToken',
  'refreshToken',
  'apiBaseUrl',
  'supabaseUrl',
  'supabaseAnonKey',
  'expiresAt',
  /** 每次连接写入时间戳，token 未变时也能触发 storage.onChanged（Options 等 UI 刷新） */
  'crowAuthUpdatedAt',
] as const;

export type CrowAuth = {
  apiBaseUrl: string;
  accessToken: string;
  refreshToken: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  expiresAt: number | undefined;
};

const REFRESH_SKEW_SEC = 120;

let refreshTail: Promise<void> = Promise.resolve();

/** `exp` from access_token JWT (seconds), no verify — only for client-side refresh timing */
function accessTokenExpSeconds(accessToken: string): number | null {
  try {
    const payloadB64 = accessToken.split('.')[1];
    if (!payloadB64) return null;
    const b64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 === 0 ? '' : '===='.slice(b64.length % 4);
    const payload = JSON.parse(atob(b64 + pad)) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

/** Earliest known access-token expiry (seconds) — avoids relying only on stored `expires_at`. */
function effectiveAccessExpSec(auth: CrowAuth): number {
  const jwtExp = accessTokenExpSeconds(auth.accessToken);
  const stored = auth.expiresAt && auth.expiresAt > 0 ? auth.expiresAt : 0;
  if (jwtExp && stored) return Math.min(jwtExp, stored);
  return jwtExp || stored || 0;
}

/** 先走 background（SW）换票，失败再本上下文 fetch（Options 等 chrome-extension:// 页有时直连也可） */
async function exchangeRefreshToken(
  supabaseUrl: string,
  supabaseAnonKey: string,
  refreshToken: string
): Promise<SupabaseRefreshResult | null> {
  const viaBg = await exchangeRefreshViaBackground(supabaseUrl, supabaseAnonKey, refreshToken);
  if (viaBg) return viaBg;
  return performSupabaseRefreshExchange(supabaseUrl, supabaseAnonKey, refreshToken);
}

function exchangeRefreshViaBackground(
  supabaseUrl: string,
  supabaseAnonKey: string,
  refreshToken: string
): Promise<SupabaseRefreshResult | null> {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(
        {
          type: 'CROW_EXCHANGE_REFRESH',
          supabaseUrl,
          supabaseAnonKey,
          refreshToken,
        },
        (response: unknown) => {
          if (chrome.runtime.lastError) {
            console.warn('[Crow ext] background refresh:', chrome.runtime.lastError.message);
            resolve(null);
            return;
          }
          const r = response as {
            ok?: boolean;
            access_token?: string;
            refresh_token?: string;
            expires_at?: number;
          };
          if (r?.ok && r.access_token && r.refresh_token) {
            resolve({
              access_token: r.access_token,
              refresh_token: r.refresh_token,
              expires_at:
                typeof r.expires_at === 'number'
                  ? r.expires_at
                  : Math.floor(Date.now() / 1000) + 3600,
            });
            return;
          }
          resolve(null);
        }
      );
    } catch (e) {
      console.warn('[Crow ext] background refresh catch', e);
      resolve(null);
    }
  });
}

function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = refreshTail.then(fn, fn);
  refreshTail = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

/** 打包时注入的公开 Supabase 配置，补齐旧版「连接插件」未写入的 url/anon，否则无法 refresh */
function applyBuildSupabaseDefaults(auth: CrowAuth): CrowAuth {
  const url =
    auth.supabaseUrl ||
    (typeof import.meta.env.VITE_PUBLIC_SUPABASE_URL === 'string'
      ? import.meta.env.VITE_PUBLIC_SUPABASE_URL
      : '') ||
    '';
  const anon =
    auth.supabaseAnonKey ||
    (typeof import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY === 'string'
      ? import.meta.env.VITE_PUBLIC_SUPABASE_ANON_KEY
      : '') ||
    '';
  return { ...auth, supabaseUrl: url.trim(), supabaseAnonKey: anon.trim() };
}

function toCrowAuthFromLocal(raw: Record<string, unknown>): CrowAuth | null {
  const apiBaseUrl = (raw.apiBaseUrl as string) || '';
  const accessToken = (raw.accessToken as string) || '';
  if (!apiBaseUrl || !accessToken) return null;
  const expiresRaw = raw.expiresAt;
  const expiresAt =
    expiresRaw === null || expiresRaw === undefined
      ? undefined
      : typeof expiresRaw === 'number'
        ? expiresRaw
        : typeof expiresRaw === 'string' && expiresRaw !== ''
          ? Number(expiresRaw)
          : undefined;
  return {
    apiBaseUrl,
    accessToken,
    refreshToken: (raw.refreshToken as string) || '',
    supabaseUrl: (raw.supabaseUrl as string) || '',
    supabaseAnonKey: (raw.supabaseAnonKey as string) || '',
    expiresAt: Number.isFinite(expiresAt) ? expiresAt : undefined,
  };
}

/** Prefer local (full session); fall back to legacy sync (access only, no refresh). */
export async function loadCrowAuth(): Promise<CrowAuth | null> {
  const local = await chrome.storage.local.get([...CROW_AUTH_LOCAL_KEYS]);
  const fromLocal = toCrowAuthFromLocal(local);
  if (fromLocal) return fromLocal;

  const sync = await chrome.storage.sync.get(['apiBaseUrl', 'accessToken']);
  const apiBaseUrl = (sync.apiBaseUrl as string) || '';
  const accessToken = (sync.accessToken as string) || '';
  if (!apiBaseUrl || !accessToken) return null;
  return {
    apiBaseUrl,
    accessToken,
    refreshToken: '',
    supabaseUrl: '',
    supabaseAnonKey: '',
    expiresAt: undefined,
  };
}

export async function persistCrowAuth(auth: CrowAuth): Promise<void> {
  await chrome.storage.local.set({
    accessToken: auth.accessToken,
    refreshToken: auth.refreshToken,
    apiBaseUrl: auth.apiBaseUrl,
    supabaseUrl: auth.supabaseUrl,
    supabaseAnonKey: auth.supabaseAnonKey,
    expiresAt: auth.expiresAt ?? null,
    crowAuthUpdatedAt: Date.now(),
  });
  await chrome.storage.sync.remove(['accessToken', 'apiBaseUrl', 'adminSecret']);
}

/**
 * If access token is near expiry or force=true, call Supabase refresh and persist.
 * Returns latest auth (may be unchanged if refresh not possible or not needed).
 */
export async function ensureFreshAuth(
  hint: CrowAuth | null,
  opts?: { force?: boolean }
): Promise<CrowAuth | null> {
  if (!hint) {
    return null;
  }

  return withRefreshLock(async () => {
    const stored = await loadCrowAuth();
    const raw = stored ?? hint;
    if (!raw?.accessToken) return null;

    const current = applyBuildSupabaseDefaults(raw);

    const backfillSupabase =
      Boolean(current.refreshToken) &&
      Boolean(current.supabaseUrl) &&
      Boolean(current.supabaseAnonKey) &&
      (!raw.supabaseUrl || !raw.supabaseAnonKey);

    if (backfillSupabase) {
      await persistCrowAuth({
        ...current,
        accessToken: raw.accessToken,
        refreshToken: raw.refreshToken,
        expiresAt: raw.expiresAt,
      });
    }

    const canRefresh =
      Boolean(current.refreshToken) && Boolean(current.supabaseUrl) && Boolean(current.supabaseAnonKey);

    if (!canRefresh) {
      console.warn('[Crow ext] cannot refresh (missing field)', {
        hasRefreshToken: Boolean(current.refreshToken),
        hasSupabaseUrl: Boolean(current.supabaseUrl),
        hasSupabaseAnonKey: Boolean(current.supabaseAnonKey),
      });
      const n = Math.floor(Date.now() / 1000);
      const expKnown = effectiveAccessExpSec(current);
      if (expKnown > 0 && expKnown <= n) {
        return null;
      }
      return current;
    }

    const now = Math.floor(Date.now() / 1000);
    const expSec = effectiveAccessExpSec(current);
    if (!opts?.force && expSec > now + REFRESH_SKEW_SEC) {
      return current;
    }

    const rest = await exchangeRefreshToken(
      current.supabaseUrl,
      current.supabaseAnonKey,
      current.refreshToken
    );

    if (!rest) {
      const expKnown = effectiveAccessExpSec(current);
      if (opts?.force || (expKnown > 0 && expKnown <= now)) {
        return null;
      }
      return current;
    }

    const next: CrowAuth = {
      ...current,
      accessToken: rest.access_token,
      refreshToken: rest.refresh_token,
      expiresAt: rest.expires_at,
    };
    await persistCrowAuth(next);
    return next;
  });
}

export async function isCrowConfigured(): Promise<boolean> {
  const a = await loadCrowAuth();
  return Boolean(a?.apiBaseUrl && a?.accessToken);
}
