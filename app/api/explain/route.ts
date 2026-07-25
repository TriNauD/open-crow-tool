import type { Stream } from 'openai/streaming';
import type { ChatCompletionChunk } from 'openai/resources/chat/completions';
import type { ChatCompletionContentPart } from 'openai/resources/chat/completions';
import OpenAI from 'openai';
import { corsHeaders, handleOptions } from '@/lib/utils/cors';
import { getProviderChain } from '@/lib/ai/providers';
import { SYSTEM_PROMPT, buildExplainPrompt } from '@/lib/ai/prompts';
import { toDataUrl, validateExplainImage } from '@/lib/ai/image-limits';

type UserContent = string | ChatCompletionContentPart[];

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

    /** 前后各 120 + 分隔符，留余量防滥用 */
    const MAX_SURROUNDING = 400;
    let surroundingText: string | undefined;
    if (typeof rawSurrounding === 'string' && rawSurrounding.trim()) {
      surroundingText = rawSurrounding.trim().slice(0, MAX_SURROUNDING);
    }

    const userPrompt = buildExplainPrompt(textStr || '（见附图）', {
      parentContext: typeof context === 'string' ? context.trim() : undefined,
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

    const chain = getProviderChain();
    if (chain.length === 0) {
      return new Response('未配置可用的 AI Provider', { status: 500 });
    }

    let stream: Stream<ChatCompletionChunk> | undefined;
    let lastErr: unknown;

    for (const { name, client, model } of chain) {
      try {
        stream = await createChatStream(client, model, userContent);
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
        ...corsHeaders,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/explain]', msg);
    return new Response(`AI 炸了：${msg}`, { status: 500 });
  }
}
