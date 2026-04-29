/**
 * GoTrue refresh_token 交换（纯 fetch）。
 * 由 service worker 调用可避免 content script 在第三方页发起请求时的 Origin/CORS 差异。
 */
export type SupabaseRefreshResult = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
};

export async function performSupabaseRefreshExchange(
  supabaseUrl: string,
  supabaseAnonKey: string,
  refreshToken: string
): Promise<SupabaseRefreshResult | null> {
  const urlIn = supabaseUrl.trim();
  const anonIn = supabaseAnonKey.trim();
  const rtIn = refreshToken.trim();
  if (!urlIn || !anonIn || !rtIn) {
    return null;
  }
  const base = urlIn.replace(/\/+$/, '');
  const res = await fetch(`${base}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      apikey: anonIn,
      Authorization: `Bearer ${anonIn}`,
    },
    body: JSON.stringify({ refresh_token: rtIn }),
  });
  if (!res.ok) {
    const snippet = await res.text();
    if (snippet.length > 0) {
      console.warn(
        '[Crow ext] refresh_token exchange failed',
        res.status,
        snippet.length > 180 ? `${snippet.slice(0, 180)}…` : snippet
      );
    }
    return null;
  }
  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
    expires_in?: number;
  };
  if (!json.access_token) return null;
  const newRefresh = json.refresh_token || rtIn;
  const n = Math.floor(Date.now() / 1000);
  let expNum: number | undefined;
  if (typeof json.expires_at === 'number') expNum = json.expires_at;
  else if (typeof json.expires_at === 'string' && json.expires_at !== '') {
    const parsed = Number(json.expires_at);
    if (Number.isFinite(parsed)) expNum = parsed;
  }
  const expires_at =
    typeof expNum === 'number'
      ? expNum
      : n + (typeof json.expires_in === 'number' ? json.expires_in : 3600);
  return {
    access_token: json.access_token,
    refresh_token: newRefresh,
    expires_at,
  };
}
