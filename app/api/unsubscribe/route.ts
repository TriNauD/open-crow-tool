import { NextRequest, NextResponse } from 'next/server';
import { cancelByToken } from '@/lib/db/subscribers';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const base = new URL(req.url).origin;

  if (!token) {
    return NextResponse.redirect(`${base}/unsubscribe?status=invalid`);
  }

  const cancelled = await cancelByToken(token);
  const status = cancelled ? 'success' : 'notfound';
  return NextResponse.redirect(`${base}/unsubscribe?status=${status}`);
}
