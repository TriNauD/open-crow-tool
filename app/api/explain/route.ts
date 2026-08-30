import type { Stream } from 'openai/streaming';
import type { ChatCompletionChunk } from 'openai/resources/chat/completions';
import type { ChatCompletionContentPart } from 'openai/resources/chat/completions';
import OpenAI from 'openai';
import { corsHeaders, handleOptions } from '@/lib/utils/cors';
import {
  EFFECTIVE_PROVIDER_HEADER,
  USER_LLM_CONFIG_HEADER,
  getProviderChain,
  parseUserLLMConfig,
} from '@/lib/ai/providers';
import { SYSTEM_PROMPT, buildExplainPrompt } from '@/lib/ai/prompts';
import { toDataUrl, validateExplainImage } from '@/lib/ai/image-limits';
import { checkRateLimit, getClientIp, isOriginAllowed } from '@/lib/request-guard';

type UserContent = string | ChatCompletionContentPart[];

/** 正文输入上限：与链接抓取的 FETCH_MAX_TEXT_CHARS 一致，链接场景够用；max_tokens 只管输出不管输入 */
const MAX_TEXT_CHARS = 12_000;
const MAX_CONTEXT_CHARS = 2_000;
/** 按 IP 固定窗口限流（默认 60 次/小时，可用环境变量调整） */
const RATE_LIMIT = Number(process.env.RATE_LIMIT_EXPLAIN_PER_HOUR ?? 60);
const RATE_WINDOW_MS = 60 * 60 * 1000;

async function createChatStream(
  client: OpenAI,
  model: string,
  userContent: UserContent
): Promise<Stream<ChatCompletionChunk>> {
  return client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userContent },
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
    const body = await req.json();
    const { text, context, surroundingText: rawSurrounding, image: rawImage } = body;

    const imageResult =
      rawImage === undefined || rawImage === null
        ? null
        : validateExplainImage(rawImage);
    if (imageResult && !imageResult.ok) {
      return new Response(imageResult.error, { status: 400 });
    }

    const hasImage = Boolean(imageResult?.ok);
    const textStr = typeof text === 'string' ? text.trim() : '';
    if (!textStr && !hasImage) {
      return new Response('Missing text', { status: 400 });
    }
    if (textStr.length > MAX_TEXT_CHARS) {
      return new Response(`文本太长了（上限 ${MAX_TEXT_CHARS} 字符），请截取重点部分再试`, {
        status: 413,
        headers: corsHeaders,
      });
    }

    /** 前后各 120 + 分隔符，留余量防滥用 */
    const MAX_SURROUNDING = 400;
    let surroundingText: string | undefined;
    if (typeof rawSurrounding === 'string' && rawSurrounding.trim()) {
      surroundingText = rawSurrounding.trim().slice(0, MAX_SURROUNDING);
    }

    let parentContext: string | undefined;
    if (typeof context === 'string' && context.trim()) {
      parentContext = context.trim().slice(0, MAX_CONTEXT_CHARS);
    }

    const userPrompt = buildExplainPrompt(textStr || '（见附图）', {
      parentContext,
      surroundingText,
      hasImage,
    });

    let userContent: UserContent = userPrompt;
    if (imageResult?.ok) {
      userContent = [
        { type: 'text', text: userPrompt },
        {
          type: 'image_url',
          image_url: { url: toDataUrl(imageResult.mimeType, imageResult.dataBase64) },
        },
      ];
    }

    // 用户自配 LLM（OpenAI-compatible）优先；校验失败静默走服务器默认链
    const userCfg = await parseUserLLMConfig(req.headers.get(USER_LLM_CONFIG_HEADER));
    const chain = getProviderChain(userCfg);
    if (chain.length === 0) {
      return new Response('未配置可用的 AI Provider', { status: 500 });
    }

    let stream: Stream<ChatCompletionChunk> | undefined;
    let usedProvider = '';
    let lastErr: unknown;

    for (const { name, client, model } of chain) {
      try {
        stream = await createChatStream(client, model, userContent);
        usedProvider = name;
        console.log(`[explain] using provider="${name}", model="${model}", hasImage=${hasImage}`);
        break;
      } catch (err) {
        lastErr = err;
        console.warn(`[explain] provider "${name}" failed, trying next...`, err);
      }
    }

    if (!stream) {
      const hint = hasImage
        ? '（截图解释需要支持视觉的模型，请在 .env 将 AI_MODEL 设为 vision 模型，如 gpt-4o）'
        : '';
      const msg = lastErr instanceof Error ? lastErr.message : String(lastErr ?? 'All AI providers failed');
      return new Response(`AI 炸了：${msg}${hint}`, { status: 500 });
    }

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
        [EFFECTIVE_PROVIDER_HEADER]: usedProvider,
        ...corsHeaders,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/explain]', msg);
    return new Response(`AI 炸了：${msg}`, { status: 500 });
  }
}
