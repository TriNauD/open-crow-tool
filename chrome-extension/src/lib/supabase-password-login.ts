/**
 * GoTrue 邮箱密码登录（纯 fetch）。
 * 与网站同一 Supabase 项目；成功后由调用方映射为 CrowAuth 并 persist。
 */

export type SupabasePasswordLoginOk = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
};

export type SupabasePasswordLoginFail = {
  ok: false;
  message: string;
  status?: number;
};

export type SupabasePasswordLoginResult =
  | ({ ok: true } & SupabasePasswordLoginOk)
  | SupabasePasswordLoginFail;

/** 将 GoTrue / 网络错误映射为可读中文（不暴露 JWT 等技术词）。 */
export function mapPasswordLoginError(raw: string, status?: number): string {
  const msg = (raw || '').toLowerCase();
  if (status === 429 || msg.includes('rate limit') || msg.includes('too many')) {
    return '尝试过于频繁，请稍后再试。';
  }
  if (typeof status === 'number' && status >= 500) {
    return '登录服务暂时不可用，请稍后重试；若反复出现，请检查网络或代理设置。';
  }
  if (
    msg.includes('invalid login credentials') ||
    msg.includes('invalid credentials') ||
    msg.includes('invalid_grant')
  ) {
    return '邮箱或密码不正确，请检查后重试。';
  }
  if (msg.includes('email not confirmed')) {
    return '邮箱尚未验证，请先前往邮箱点击验证链接，再回来登录。';
  }
  if (msg.includes('failed to fetch') || msg.includes('network') || status === 0) {
    return '网络异常，请检查网络后重试。';
  }
  if (raw.trim()) {
    return raw.trim().length > 160 ? `${raw.trim().slice(0, 160)}…` : raw.trim();
  }
  return '登录失败，请稍后重试。';
}

export async function performSupabasePasswordLogin(
  supabaseUrl: string,
  supabaseAnonKey: string,
  email: string,
  password: string
): Promise<SupabasePasswordLoginResult> {
  const base = supabaseUrl.trim().replace(/\/+$/, '');
  const anon = supabaseAnonKey.trim();
  const em = email.trim();
  if (!base || !anon) {
    return {
      ok: false,
      message: '扩展未配置登录服务，请重新构建扩展或使用「与网站同步」。',
    };
  }
  if (!em || !password) {
    return { ok: false, message: '请填写邮箱和密码。' };
  }

  let res: Response;
  try {
    res = await fetch(`${base}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        apikey: anon,
        Authorization: `Bearer ${anon}`,
      },
      body: JSON.stringify({ email: em, password }),
    });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    return { ok: false, message: mapPasswordLoginError(raw, 0), status: 0 };
  }

  if (!res.ok) {
    let snippet = '';
    try {
      const body = (await res.json()) as { error_description?: string; msg?: string; error?: string };
      snippet = body.error_description || body.msg || body.error || '';
    } catch {
      try {
        snippet = await res.text();
      } catch {
        snippet = '';
      }
    }
    return {
      ok: false,
      message: mapPasswordLoginError(snippet || `HTTP ${res.status}`, res.status),
      status: res.status,
    };
  }

  const json = (await res.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
    expires_in?: number;
  };
  if (!json.access_token || !json.refresh_token) {
    return { ok: false, message: '登录响应异常，请稍后重试。' };
  }
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
    ok: true,
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    expires_at,
  };
}
