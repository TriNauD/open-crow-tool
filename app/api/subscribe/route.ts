import { NextRequest, NextResponse } from 'next/server';
import { createSubscriber } from '@/lib/db/subscribers';
import { sendWelcomeEmail, sendReactivationEmail } from '@/lib/email';

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// In-memory rate limit: same IP, max 3 requests per 60s
const rateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'unknown';
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: '请求过于频繁，请稍后再试' }, { status: 429 });
  }

  try {
    const body = await req.json();
    const email = typeof body?.email === 'string' ? body.email.trim() : '';

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: '请输入有效的邮箱地址' }, { status: 400 });
    }

    const { subscriber, alreadyExists, reactivated } = await createSubscriber(email);

    if (!alreadyExists) {
      const base = new URL(req.url).origin;
      const unsubscribeUrl = `${base}/api/unsubscribe?token=${subscriber.unsubscribe_token}`;
      if (reactivated) {
        sendReactivationEmail(email, unsubscribeUrl).catch((err) =>
          console.error('[subscribe] reactivation email failed:', err)
        );
      } else {
        sendWelcomeEmail(email, unsubscribeUrl).catch((err) =>
          console.error('[subscribe] welcome email failed:', err)
        );
      }
    }

    return NextResponse.json(
      { ok: true, alreadyExists, reactivated },
      { status: alreadyExists ? 200 : 201 }
    );
  } catch (err) {
    console.error('[POST /api/subscribe]', err);
    return NextResponse.json({ error: '订阅失败，请稍后重试' }, { status: 500 });
  }
}
