import { NextRequest, NextResponse } from 'next/server';
import { corsHeaders, handleOptions } from '@/lib/utils/cors';
import { FetchSafeError, fetchUrlSafe } from '@/lib/url/fetch-safe';

export function OPTIONS() {
  return handleOptions();
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = typeof body?.url === 'string' ? body.url : '';
    if (!url.trim()) {
      return NextResponse.json(
        { error: 'url is required', code: 'INVALID_URL' },
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
