import { createClient } from '@supabase/supabase-js';

/** Keys persisted in chrome.storage.local for site-driven connect (see content bridge). */
export const CROW_AUTH_LOCAL_KEYS = [
  'accessToken',
  'refreshToken',
  'apiBaseUrl',
  'supabaseUrl',
  'supabaseAnonKey',
  'expiresAt',
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

/** GoTrue REST fallback when `auth.refreshSession` fails in the content script context */
async function exchangeRefreshToken(
  supabaseUrl: string,
  supabaseAnonKey: string,
  refreshToken: string
): Promise<{ access_token: string; refresh_token: string; expires_at: number } | null> {
  const base = supabaseUrl.replace(/\/+$/, '');
  const res = await fetch(`${base}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
    expires_in?: number;
  };
  if (!json.access_token) return null;
  const newRefresh = json.refresh_token || refreshToken;
  const n = Math.floor(Date.now() / 1000);
  const expires_at =
    typeof json.expires_at === 'number'
      ? json.expires_at
      : n + (typeof json.expires_in === 'number' ? json.expires_in : 3600);
  return {
    access_token: json.access_token,
    refresh_token: newRefresh,
    expires_at,
  };
}

function withRefreshLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = refreshTail.then(fn, fn);
  refreshTail = next.then(
    () => undefined,
    () => undefined
  );
  return next;
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
  if (!hint) return null;

  return withRefreshLock(async () => {
    const current = await loadCrowAuth();
    if (!current) return null;

    const canRefresh =
      Boolean(current.refreshToken) && Boolean(current.supabaseUrl) && Boolean(current.supabaseAnonKey);

    if (!canRefresh) {
      return current;
    }

    const now = Math.floor(Date.now() / 1000);
    const expSec = effectiveAccessExpSec(current);
    if (!opts?.force && expSec > now + REFRESH_SKEW_SEC) {
      return current;
    }

    let access_token: string | undefined;
    let refresh_token: string | undefined;
    let expires_at: number | undefined;

    try {
      const client = createClient(current.supabaseUrl, current.supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });

      const { data, error } = await client.auth.refreshSession({
        refresh_token: current.refreshToken,
      });

      if (!error && data.session) {
        access_token = data.session.access_token;
        refresh_token = data.session.refresh_token || current.refreshToken;
        expires_at = data.session.expires_at ?? undefined;
      }
    } catch {
      /* fall through to REST */
    }

    if (!access_token || !refresh_token) {
      const rest = await exchangeRefreshToken(
        current.supabaseUrl,
        current.supabaseAnonKey,
        current.refreshToken
      );
      if (rest) {
        access_token = rest.access_token;
        refresh_token = rest.refresh_token;
        expires_at = rest.expires_at;
      }
    }

    if (!access_token || !refresh_token) {
      const expKnown = effectiveAccessExpSec(current);
      if (opts?.force || (expKnown > 0 && expKnown <= now)) {
        return null;
      }
      return current;
    }

    const next: CrowAuth = {
      ...current,
      accessToken: access_token,
      refreshToken: refresh_token,
      expiresAt: expires_at,
    };
    await persistCrowAuth(next);
    return next;
  });
}

export async function isCrowConfigured(): Promise<boolean> {
  const a = await loadCrowAuth();
  return Boolean(a?.apiBaseUrl && a?.accessToken);
}
