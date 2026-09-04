import type { Stream } from 'openai/streaming';
import type { ChatCompletionChunk } from 'openai/resources/chat/completions';
import type { ChatCompletionContentPart } from 'openai/resources/chat/completions';
import OpenAI from 'openai';
import { corsHeaders, handleOptions } from '@/lib/utils/cors';
import {
  EFFECTIVE_PROVIDER_HEADER,
  USER_LLM_CONFIG_HEADER,
  MODEL_PRICING_CNY_PER_M,
  estimateCostCny,
  getModelForProvider,
  getProviderChain,
  parseUserLLMConfig,
} from '@/lib/ai/providers';
import { SYSTEM_PROMPT, buildExplainPrompt } from '@/lib/ai/prompts';
import { toDataUrl, validateExplainImage } from '@/lib/ai/image-limits';
import {
  budgetDecide,
  budgetReserve,
  budgetSettle,
  getClientIp,
  isOriginAllowed,
} from '@/lib/request-guard';

type UserContent = string | ChatCompletionContentPart[];

/** 正文输入上限：与链接抓取的 FETCH_MAX_TEXT_CHARS 一致，链接场景够用；max_tokens 只管输出不管输入 */
const MAX_TEXT_CHARS = 12_000;
const MAX_CONTEXT_CHARS = 2_000;
/** 单日单人预算（元），用完后降级免费模型；可用 EXPLAIN_DAILY_BUDGET_CNY 调整 */
const DAILY_BUDGET_CNY = Number(process.env.EXPLAIN_DAILY_BUDGET_CNY ?? 2);

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
      // 最后一块带 usage，用于预算按真实 token 结算
      stream_options: { include_usage: true },
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

  // 用户自配模型烧用户自己的额度，不参与预算；服务器默认模型走「单日 ¥2/人」预算路由
  const userCfg = parseUserLLMConfig(req.headers.get(USER_LLM_CONFIG_HEADER));
  let budgetOk = true;
  let reservedCostCny = 0;
  let premiumModel = '';

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

    // 预算路由：无自配时才参与。先用付费档判预估费是否在今日预算内；
    // 超了就降级免费档（预算外不再列入 nvidia 等付费兜底）
    if (!userCfg) {
      const ip = getClientIp(req);
      premiumModel = getModelForProvider('siliconflow', { hasImage, budgetOk: true });
      const estCost = estimateCostCny(premiumModel, textStr.length, hasImage);
      const decision = await budgetDecide('explain', ip, estCost, DAILY_BUDGET_CNY);
      budgetOk = decision.premium;
      reservedCostCny = estCost;
      if (budgetOk) await budgetReserve('explain', ip, estCost);
      console.log(
        `[explain] budget ip="${ip}" est=¥${estCost.toFixed(4)} premium=${budgetOk} remaining=¥${decision.remaining.toFixed(2)}`
      );
    }

    const chain = getProviderChain(userCfg, { hasImage, budgetOk });
    if (chain.length === 0) {
      return new Response('未配置可用的 AI Provider', { status: 500 });
    }

    let stream: Stream<ChatCompletionChunk> | undefined;
    let usedProvider = '';
    let usedModel = '';
    let lastErr: unknown;

    for (const { name, client, model } of chain) {
      try {
        stream = await createChatStream(client, model, userContent);
        usedProvider = name;
        usedModel = model;
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
    let streamUsage: { promptTokens?: number; completionTokens?: number } | undefined;
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta?.content ?? '';
            if (delta) {
              controller.enqueue(encoder.encode(delta));
            }
            if (chunk.usage) {
              streamUsage = {
                promptTokens: chunk.usage.prompt_tokens ?? 0,
                completionTokens: chunk.usage.completion_tokens ?? 0,
              };
            }
          }
        } finally {
          controller.close();
          // 预算结算：有真实 usage 按实际补记差额；无 usage（中断/上游不回）保留预估，成本已发生
          if (budgetOk && !userCfg) {
            const p = MODEL_PRICING_CNY_PER_M[usedModel];
            const actual =
              p && streamUsage
                ? ((streamUsage.promptTokens ?? 0) / 1e6) * p.input +
                  ((streamUsage.completionTokens ?? 0) / 1e6) * p.output
                : reservedCostCny;
            void budgetSettle('explain', getClientIp(req), actual, reservedCostCny);
          }
        }
      },
    });

    const responseHeaders: Record<string, string> = {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      [EFFECTIVE_PROVIDER_HEADER]: usedProvider,
      ...corsHeaders,
    };
    if (budgetOk === false && !userCfg) {
      // 预算用完后降级免费模型的标记，客户端据此提示
      responseHeaders['x-crow-quota-out'] = '1';
    }

    return new Response(readable, { headers: responseHeaders });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[/api/explain]', msg);
    return new Response(`AI 炸了：${msg}`, { status: 500 });
  }
}
