import type { Stream } from 'openai/streaming';
import type { ChatCompletionChunk } from 'openai/resources/chat/completions';
import OpenAI from 'openai';
import { corsHeaders, handleOptions } from '@/lib/cors';
import {
  getModelForProvider,
  getNvidiaModel,
  getNvidiaOpenAI,
  getOpenAIForProvider,
  getPrimaryProvider,
  isNvidiaFallbackEnabled,
} from '@/lib/ai-providers';
import { SYSTEM_PROMPT, buildExplainPrompt } from '@/lib/prompts';

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

function shouldTryNvidiaFallback(): boolean {
  if (getPrimaryProvider() === 'nvidia') return false;
  if (!process.env.NVIDIA_API_KEY?.trim()) return false;
  return isNvidiaFallbackEnabled();
}

export function OPTIONS() {
  return handleOptions();
}

export async function POST(req: Request) {
  try {
    const { text, context } = await req.json();

    if (!text || typeof text !== 'string') {
      return new Response('Missing text', { status: 400 });
    }

    const userPrompt = buildExplainPrompt(text.trim(), context?.trim());
    const primary = getPrimaryProvider();

    let stream: Stream<ChatCompletionChunk>;
    try {
      stream = await createChatStream(
        getOpenAIForProvider(primary),
        getModelForProvider(primary),
        userPrompt
      );
    } catch (primaryErr) {
      if (!shouldTryNvidiaFallback()) {
        throw primaryErr;
      }
      stream = await createChatStream(
        getNvidiaOpenAI(),
        getNvidiaModel(),
        userPrompt
      );
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
