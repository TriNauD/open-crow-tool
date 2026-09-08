import { NextRequest, NextResponse } from 'next/server';
import { corsHeaders, handleOptions } from '@/lib/utils/cors';
import { classifyCategory, USER_LLM_CONFIG_HEADER } from '@/lib/ai/classify';
import { checkRateLimit, getClientIp } from '@/lib/request-guard';

/** 每个请求都会真实触发一次 AI 调用（最多串 3 家 provider），必须按 IP 限流防白嫖 */
const RATE_LIMIT = Number(process.env.RATE_LIMIT_EXPLAIN_TAG_PER_MIN ?? 20);
const RATE_WINDOW_MS = 60_000;

export function OPTIONS() {
  return handleOptions();
}

/**
 * 轻量总结分类：输入「被解释内容」+「解释正文」，返回单条笔记的总结 tag。
 * 与 /api/notes 一致——不加 Origin 护栏（解释流式接口才需要），
 * 以便 chrome 扩展直连也能命中；但成本在服务端，故用按 IP 限流兜住滥用。
 */
export async function POST(req: NextRequest) {
  // 无鉴权 + 每次都烧 AI：限流先于任何解析，超限直接 429，不进 provider 链
  const rl = await checkRateLimit('explain-tag', getClientIp(req), RATE_LIMIT, RATE_WINDOW_MS);
  if (!rl.ok) {
    return NextResponse.json(
      { error: '请求太频繁了，请稍后再试', code: 'RATE_LIMITED' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfterSec), ...corsHeaders } }
    );
  }

  try {
    const body = (await req.json()) as { inputText?: unknown; explanation?: unknown };
    const inputText = typeof body.inputText === 'string' ? body.inputText.trim() : '';
    const explanation = typeof body.explanation === 'string' ? body.explanation : '';

    if (!inputText) {
      return NextResponse.json({ error: 'inputText is required' }, { status: 400 });
    }

    const tag = await classifyCategory({
      inputText,
      explanation,
      userLlmConfigHeader: req.headers.get(USER_LLM_CONFIG_HEADER),
    });

    return NextResponse.json({ data: { tag } }, { headers: corsHeaders });
  } catch (err) {
    console.error('[POST /api/explain/tag]', err);
    return NextResponse.json({ error: 'classification failed' }, { status: 500 });
  }
}
