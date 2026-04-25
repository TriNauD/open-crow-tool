import { NextRequest, NextResponse } from 'next/server';
import { createSubscriber } from '@/lib/db/subscribers';

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = typeof body?.email === 'string' ? body.email.trim() : '';

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: '请输入有效的邮箱地址' }, { status: 400 });
    }

    const { alreadyExists } = await createSubscriber(email);

    return NextResponse.json(
      { ok: true, alreadyExists },
      { status: alreadyExists ? 200 : 201 }
    );
  } catch (err) {
    console.error('[POST /api/subscribe]', err);
    return NextResponse.json({ error: '订阅失败，请稍后重试' }, { status: 500 });
  }
}
