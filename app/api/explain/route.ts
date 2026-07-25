import type { Stream } from 'openai/streaming';
import type { ChatCompletionChunk } from 'openai/resources/chat/completions';
import OpenAI from 'openai';
import { corsHeaders, handleOptions } from '@/lib/utils/cors';
import { getProviderChain } from '@/lib/ai/providers';
import { SYSTEM_PROMPT, buildExplainPrompt } from '@/lib/ai/prompts';

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
  try {
    const { text, context, surroundingText: rawSurrounding } = await req.json();

    if (!text || typeof text !== 'string') {
      return new Response('Missing text', { status: 400 });
    }

    /** 前后各 120 + 分隔符，留余量防滥用 */
    const MAX_SURROUNDING = 400;
    let surroundingText: string | undefined;
    if (typeof rawSurrounding === 'string' && rawSurrounding.trim()) {
      surroundingText = rawSurrounding.trim().slice(0, MAX_SURROUNDING);
    }

    const userPrompt = buildExplainPrompt(text.trim(), {
      parentContext: typeof context === 'string' ? context.trim() : undefined,
      surroundingText,
    });
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
