import { NextResponse } from 'next/server';
import { corsHeaders, handleOptions } from '@/lib/utils/cors';

/**
 * 飞书事件订阅占位（D-2）。
 * 有意不接通：完整集成待商业/选型 Go，见
 * `dev/active/飞书等平台/飞书等平台-evaluation.md`
 */
export function OPTIONS() {
  return handleOptions();
}

export async function POST() {
  return NextResponse.json(
    {
      error: 'Feishu integration is not enabled',
      code: 'FEISHU_NOT_ENABLED',
      docs: 'dev/active/飞书等平台/飞书等平台-evaluation.md',
    },
    { status: 501, headers: corsHeaders }
  );
}

export async function GET() {
  return POST();
}
