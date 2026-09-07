import { NextRequest, NextResponse } from 'next/server';
import { corsHeaders, handleOptions } from '@/lib/utils/cors';
import { classifyCategory, USER_LLM_CONFIG_HEADER } from '@/lib/ai/classify';

export function OPTIONS() {
  return handleOptions();
}

/**
 * 轻量总结分类：输入「被解释内容」+「解释正文」，返回单条笔记的总结 tag。
 * 与 /api/notes 一致——不加 Origin 护栏（解释流式接口才需要），
 * 以便 chrome 扩展直连也能命中；跨站滥用风险低（仅返回分类词）。
 */
export async function POST(req: NextRequest) {
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
