import OpenAI from 'openai';
import { SYSTEM_PROMPT, buildExplainPrompt } from '@/lib/prompts';

const PROVIDER_DEFAULTS: Record<string, { baseURL: string; model: string }> = {
  openai:      { baseURL: 'https://api.openai.com/v1',      model: 'gpt-4o' },
  deepseek:    { baseURL: 'https://api.deepseek.com/v1',    model: 'deepseek-chat' },
  siliconflow: { baseURL: 'https://api.siliconflow.cn/v1',  model: 'deepseek-ai/DeepSeek-V3' },
};

function getAIClient() {
  const provider = (process.env.AI_PROVIDER ?? 'openai').toLowerCase();
  const defaults = PROVIDER_DEFAULTS[provider] ?? PROVIDER_DEFAULTS.openai;

  const apiKey =
    process.env.AI_API_KEY ??
    process.env.DEEPSEEK_API_KEY ??
    process.env.OPENAI_API_KEY;

  const baseURL = process.env.AI_BASE_URL ?? defaults.baseURL;

  return new OpenAI({ apiKey, baseURL });
}

function getModel() {
  const provider = (process.env.AI_PROVIDER ?? 'openai').toLowerCase();
  const defaults = PROVIDER_DEFAULTS[provider] ?? PROVIDER_DEFAULTS.openai;
  return (
    process.env.AI_MODEL ??
    process.env.DEEPSEEK_MODEL ??
    process.env.OPENAI_MODEL ??
    defaults.model
  );
}

export async function POST(req: Request) {
  try {
    const { text, context } = await req.json();

    if (!text || typeof text !== 'string') {
      return new Response('Missing text', { status: 400 });
    }

    const userPrompt = buildExplainPrompt(text.trim(), context?.trim());

    const stream = await getAIClient().chat.completions.create({
      model: getModel(),
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 400,
      temperature: 0.7,
      stream: true,
    });

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
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/explain]', msg);
    return new Response(`AI 炸了：${msg}`, { status: 500 });
  }
}
