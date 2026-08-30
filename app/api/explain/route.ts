import type { Stream } from 'openai/streaming';
import type { ChatCompletionChunk } from 'openai/resources/chat/completions';
import OpenAI from 'openai';
import { corsHeaders, handleOptions } from '@/lib/utils/cors';
import { getProviderChain } from '@/lib/ai/providers';
import { SYSTEM_PROMPT, buildExplainPrompt } from '@/lib/ai/prompts';
import { checkRateLimit, getClientIp, isOriginAllowed } from '@/lib/request-guard';

/** 正文输入上限：与链接抓取的 FETCH_MAX_TEXT_CHARS 一致，链接场景够用；max_tokens 只管输出不管输入 */
const MAX_TEXT_CHARS = 12_000;
const MAX_CONTEXT_CHARS = 2_000;
/** 按 IP 固定窗口限流（默认 60 次/小时，可用环境变量调整） */
const RATE_LIMIT = Number(process.env.RATE_LIMIT_EXPLAIN_PER_HOUR ?? 60);
const RATE_WINDOW_MS = 60 * 60 * 1000;

async function createChatStream(
  client: OpenAI,
  model: string,
  userPrompt: string
): Promise<Stream<ChatCompletionChunk>> {
  return client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
    max_tokens: 400,
    temperature: 0.7,
    stream: true,
  });
}

export function OPTIONS() {
  return handleOptions();
}

export async function POST(req: Request) {
  // 烧钱接口三道护栏：Origin 纵深防御 → 按 IP 限流 → 输入长度上限
  if (!isOriginAllowed(req)) {
    return new Response('Origin 不被允许', { status: 403, headers: corsHeaders });
  }

  const rl = await checkRateLimit('explain', getClientIp(req), RATE_LIMIT, RATE_WINDOW_MS);
  if (!rl.ok) {
    console.warn(`[explain] rate limited ip="${getClientIp(req)}" backend=${rl.backend}`);
    return new Response('请求太频繁了，请稍后再试', {
      status: 429,
      headers: { 'Retry-After': String(rl.retryAfterSec), ...corsHeaders },
    });
  }

  try {
    const { text, context } = await req.json();

    if (!text || typeof text !== 'string') {
      return new Response('Missing text', { status: 400 });
    }
    const textStr = text.trim();
    if (textStr.length > MAX_TEXT_CHARS) {
      return new Response(`文本太长了（上限 ${MAX_TEXT_CHARS} 字符），请截取重点部分再试`, {
        status: 413,
        headers: corsHeaders,
      });
    }

    let contextStr: string | undefined;
    if (context && typeof context === 'string') {
      contextStr = context.trim().slice(0, MAX_CONTEXT_CHARS) || undefined;
    }

    const userPrompt = buildExplainPrompt(textStr, contextStr);
    const chain = getProviderChain();

    let stream: Stream<ChatCompletionChunk> | undefined;
    let lastErr: unknown;

    for (const { name, client, model } of chain) {
      try {
        stream = await createChatStream(client, model, userPrompt);
        console.log(`[explain] using provider="${name}", model="${model}"`);
        break;
      } catch (err) {
        lastErr = err;
        console.warn(`[explain] provider "${name}" failed, trying next...`);
      }
    }

    if (!stream) throw lastErr ?? new Error('All AI providers failed');

    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content ?? '';
            if (delta) {
              controller.enqueue(encoder.encode(delta));
            }
          }
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        ...corsHeaders,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/explain]', msg);
    return new Response(`AI 炸了：${msg}`, { status: 500 });
  }
}
