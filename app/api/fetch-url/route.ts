import { NextRequest, NextResponse } from 'next/server';
import { corsHeaders, handleOptions } from '@/lib/utils/cors';
import { FetchSafeError, fetchUrlSafe } from '@/lib/url/fetch-safe';
import { checkRateLimit, getClientIp, isOriginAllowed } from '@/lib/request-guard';

/** URL 长度上限 + 按 IP 固定窗口限流（抓取有 SSRF 防护，但带宽也需防白嫖） */
const MAX_URL_CHARS = 2048;
const RATE_LIMIT = Number(process.env.RATE_LIMIT_FETCH_URL_PER_HOUR ?? 20);
const RATE_WINDOW_MS = 60 * 60 * 1000;

export function OPTIONS() {
  return handleOptions();
}

export async function POST(req: NextRequest) {
  if (!isOriginAllowed(req)) {
    return NextResponse.json(
      { error: 'Origin 不被允许', code: 'ORIGIN_BLOCKED' },
      { status: 403, headers: corsHeaders }
    );
  }

  const rl = await checkRateLimit('fetch-url', getClientIp(req), RATE_LIMIT, RATE_WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      { error: '请求太频繁了，请稍后再试', code: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec), ...corsHeaders } }
    );
  }

  try {
    const body = await req.json();
    const url = typeof body?.url === 'string' ? body.url : '';
    if (!url.trim()) {
      return NextResponse.json(
        { error: 'url is required', code: 'INVALID_URL' },
        { status: 400, headers: corsHeaders }
      );
    }
    if (url.trim().length > MAX_URL_CHARS) {
      return NextResponse.json(
        { error: 'url too long', code: 'INVALID_URL' },
        { status: 400, headers: corsHeaders }
      );
    }

    const data = await fetchUrlSafe(url);
    return NextResponse.json({ data }, { headers: corsHeaders });
  } catch (err) {
    if (err instanceof FetchSafeError) {
      const status =
        err.code === 'TIMEOUT' || err.code === 'HTTP_ERROR' || err.code === 'EMPTY'
          ? 422
          : 400;
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status, headers: corsHeaders }
      );
    }
    console.error('[POST /api/fetch-url]', err);
    return NextResponse.json(
      { error: 'fetch failed', code: 'HTTP_ERROR' },
      { status: 500, headers: corsHeaders }
    );
  }
}
