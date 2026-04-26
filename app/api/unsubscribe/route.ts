import { NextRequest, NextResponse } from 'next/server';
import { cancelByToken } from '@/lib/db/subscribers';
import { sendUnsubscribeConfirmEmail } from '@/lib/email';

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token');
  const base = new URL(req.url).origin;

  if (!token) {
    return NextResponse.redirect(`${base}/unsubscribe?status=invalid`);
  }

  const cancelled = await cancelByToken(token);
  const status = cancelled ? 'success' : 'notfound';

  if (cancelled) {
    const resubscribeUrl = `${base}/subscribe`;
    sendUnsubscribeConfirmEmail(cancelled.email, resubscribeUrl).catch((err) =>
      console.error('[unsubscribe] confirmation email failed:', err)
    );
  }

  return NextResponse.redirect(`${base}/unsubscribe?status=${status}`);
}
