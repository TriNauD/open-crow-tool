import { isOriginAllowed } from '@/lib/request-guard';
import { cancelByToken, getSubscriberByToken } from '@/lib/db/subscribers';
import { sendUnsubscribeConfirmEmail } from '@/lib/email';

/**
 * 退订两步化：GET 只渲染确认页（只读查询，不改动订阅状态），
 * 用户在确认页点「确认退订」提交 POST 才真正取消。
 * 背景：Apple Mail 隐私代理 / Outlook SafeLinks 会自动预取邮件内 GET 链接，
 * 旧版「GET 即退订」导致用户没点就被退订、周报流失。
 */

function pageUrl(base: string, params: Record<string, string>): string {
  const url = new URL('/unsubscribe', base);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return url.toString();
}

function redirect(base: string, params: Record<string, string>, status = 307): Response {
  return new Response(null, {
    status,
    headers: { Location: pageUrl(base, params) },
  });
}

export async function GET(req: Request): Promise<Response> {
  const base = new URL(req.url).origin;
  const token = new URL(req.url).searchParams.get('token');

  if (!token) {
    return redirect(base, { status: 'invalid' });
  }

  // 只读查询：预取或误触不会退订；无效 token（已退订/不存在）直接给 notfound
  const subscriber = await getSubscriberByToken(token);
  if (!subscriber) {
    return redirect(base, { status: 'notfound' });
  }

  return redirect(base, { token });
}

export async function POST(req: Request): Promise<Response> {
  const base = new URL(req.url).origin;

  // 纵深防御：确认页发起的表单 POST 是同源的；带第三方 Origin 的 POST 直接拒绝
  if (!isOriginAllowed(req)) {
    return new Response('Origin 不被允许', { status: 403 });
  }

  let token: string | null = null;
  const contentType = req.headers.get('content-type') ?? '';
  try {
    if (contentType.includes('application/json')) {
      const body = (await req.json()) as { token?: unknown };
      token = typeof body.token === 'string' ? body.token : null;
    } else {
      const form = await req.formData();
      const raw = form.get('token');
      token = typeof raw === 'string' ? raw : null;
    }
  } catch {
    token = null;
  }

  if (!token) {
    return redirect(base, { status: 'invalid' }, 303);
  }

  const cancelled = await cancelByToken(token);
  const status = cancelled ? 'success' : 'notfound';

  if (cancelled) {
    const resubscribeUrl = `${base}/subscribe`;
    sendUnsubscribeConfirmEmail(cancelled.email, resubscribeUrl).catch((err) =>
      console.error('[unsubscribe] confirmation email failed:', err)
    );
  }

  return redirect(base, { status }, 303);
}
