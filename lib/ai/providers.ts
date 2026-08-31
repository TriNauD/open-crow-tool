import OpenAI from 'openai';
import { assertSafeHttpUrl } from '@/lib/url/fetch-safe';

/** 透传用户自配 LLM（OpenAI-compatible）的请求头名，值为 base64url(JSON) */
export const USER_LLM_CONFIG_HEADER = 'x-crow-llm-config';

/** 实际生效的 provider 名，随响应头返回，供「测试连接」判断回退 */
export const EFFECTIVE_PROVIDER_HEADER = 'x-crow-provider';

const USER_LLM_CONFIG_HEADER_MAX = 1024;
const USER_LLM_LIMITS = { baseURL: 300, apiKey: 256, model: 120 };

export type UserLLMConfig = { baseURL: string; apiKey: string; model: string };

const PROVIDER_DEFAULTS: Record<string, { baseURL: string; model: string }> = {
  openai:      { baseURL: 'https://api.openai.com/v1',              model: 'gpt-4o' },
  // 默认走免费回退阶梯（see SILICONFLOW_TIER_MODELS）；这里只留兜底值
  siliconflow: { baseURL: 'https://api.siliconflow.cn/v1',          model: 'Qwen/Qwen3-30B-A3B-Instruct-2507' },
  nvidia:      { baseURL: 'https://integrate.api.nvidia.com/v1',    model: 'meta/llama-3.3-70b-instruct' },
};

/**
 * 免费回退阶梯（siliconflow）：
 * - 预算内（单日 ¥2 未用完）：带图走视觉模型，不带图走速度优先的便宜通用模型
 * - 预算用完后：全部切免费模型（带图免费 OCR、不带图免费通用）
 */
const SILICONFLOW_TIER_MODELS = {
  budgetOkImage: 'Qwen/Qwen3-VL-8B-Instruct',            // 视觉
  budgetOkText:  'Qwen/Qwen3-30B-A3B-Instruct-2507',     // 速度优先
  budgetOutImage: 'PaddlePaddle/PaddleOCR-VL-1.5',       // 免费 OCR/视觉
  budgetOutText:  'Qwen/Qwen3-8B',                       // 免费通用
} as const;

/** 模型单价（元/百万 token），供预算路由预估与结算 */
export const MODEL_PRICING_CNY_PER_M: Record<string, { input: number; output: number }> = {
  'Qwen/Qwen3-VL-8B-Instruct':        { input: 0.5, output: 2.0 },
  'Qwen/Qwen3-30B-A3B-Instruct-2507': { input: 0.7, output: 2.8 },
  // 免费档
  'PaddlePaddle/PaddleOCR-VL-1.5':    { input: 0, output: 0 },
  'Qwen/Qwen3-8B':                    { input: 0, output: 0 },
};

/**
 * 预估单次请求费用（元）：输入按字符粗估 token（含图片按固定图片 token），输出保守按上限估。
 */
export function estimateCostCny(
  model: string,
  inputChars: number,
  hasImage: boolean,
  outputTokens = 200
): number {
  const pricing = MODEL_PRICING_CNY_PER_M[model];
  if (!pricing) return 0;
  const imageTokens = hasImage ? 1500 : 0;
  const inputTokens = Math.ceil(inputChars * 1.8) + imageTokens;
  return (inputTokens / 1e6) * pricing.input + (outputTokens / 1e6) * pricing.output;
}

export type ChainOptions = {
  /** 带图（视觉模型 vs 文本模型） */
  hasImage?: boolean;
  /** 今日预算是否未用完；false 时只走免费模型 */
  budgetOk?: boolean;
};

const FALLBACK_ORDER = ['siliconflow', 'nvidia'] as const;

export function getPrimaryProvider(): string {
  return (process.env.AI_PROVIDER ?? 'siliconflow').toLowerCase();
}

function resolveApiKey(provider: string): string | undefined {
  const p = provider.toLowerCase();
  const isPrimary = p === getPrimaryProvider();

  const envMap: Record<string, string | undefined> = {
    openai:      process.env.OPENAI_API_KEY,
    siliconflow: process.env.SILICONFLOW_API_KEY,
    nvidia:      process.env.NVIDIA_API_KEY,
  };

  if (isPrimary) {
    return process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY;
  }
  return envMap[p];
}

export function getOpenAIForProvider(provider: string): OpenAI {
  const p = provider.toLowerCase();
  const defaults = PROVIDER_DEFAULTS[p] ?? PROVIDER_DEFAULTS.openai;

  const baseURL =
    p === getPrimaryProvider()
      ? process.env.AI_BASE_URL ?? defaults.baseURL
      : defaults.baseURL;

  const apiKey = resolveApiKey(p) ?? '';

  return new OpenAI({ apiKey, baseURL });
}

function defaultModelFor(provider: string, opts: ChainOptions = {}): string {
  const p = provider.toLowerCase();
  const defaults = PROVIDER_DEFAULTS[p] ?? PROVIDER_DEFAULTS.openai;

  // siliconflow 是免费回退阶梯的主场，按预算和带图选模型
  if (p === 'siliconflow') {
    if (opts.budgetOk === false) {
      return opts.hasImage
        ? SILICONFLOW_TIER_MODELS.budgetOutImage
        : SILICONFLOW_TIER_MODELS.budgetOutText;
    }
    return opts.hasImage
      ? SILICONFLOW_TIER_MODELS.budgetOkImage
      : SILICONFLOW_TIER_MODELS.budgetOkText;
  }

  if (p === getPrimaryProvider()) {
    return process.env.AI_MODEL ?? process.env.OPENAI_MODEL ?? defaults.model;
  }

  if (p === 'nvidia') return process.env.NVIDIA_MODEL ?? defaults.model;

  return defaults.model;
}

export function getModelForProvider(provider: string, opts?: ChainOptions): string {
  return defaultModelFor(provider, opts);
}

/**
 * 解析并校验用户自配的 LLM 配置（来自 X-Crow-LLM-Config 头，base64url JSON）。
 * 任何不合法（格式、长度、非 https、私网/内网地址）一律返回 null，
 * 调用方静默忽略并走服务器默认 provider 链，不给用户报错。
 */
export function parseUserLLMConfig(raw: string | null | undefined): UserLLMConfig | null {
  if (!raw || raw.length > USER_LLM_CONFIG_HEADER_MAX) return null;

  let decoded: string;
  try {
    const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
    decoded = Buffer.from(b64, 'base64').toString('utf8');
  } catch {
    return null;
  }

  let obj: unknown;
  try {
    obj = JSON.parse(decoded);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object') return null;

  const { baseURL, apiKey, model } = obj as Record<string, unknown>;
  if (typeof baseURL !== 'string' || typeof apiKey !== 'string' || typeof model !== 'string') {
    return null;
  }

  const url = baseURL.trim().replace(/\/+$/, '');
  const key = apiKey.trim();
  const mdl = model.trim();
  if (!url || !key || !mdl) return null;
  if (
    url.length > USER_LLM_LIMITS.baseURL ||
    key.length > USER_LLM_LIMITS.apiKey ||
    mdl.length > USER_LLM_LIMITS.model
  ) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  const isLocalHttp =
    parsed.protocol === 'http:' &&
    (host === 'localhost' || host.endsWith('.localhost') || host === '127.0.0.1' || host === '[::1]');

  if (!isLocalHttp || process.env.NODE_ENV === 'production') {
    if (parsed.protocol !== 'https:') return null;
    try {
      assertSafeHttpUrl(url);
    } catch {
      return null;
    }
  }

  return { baseURL: url, apiKey: key, model: mdl };
}

/**
 * Build ordered provider chain: [user custom (if any), primary, ...fallbacks].
 * Only includes env providers that have an API key configured.
 */
export function getProviderChain(
  userCfg?: UserLLMConfig | null,
  opts?: ChainOptions
): { name: string; client: OpenAI; model: string }[] {
  const chain: { name: string; client: OpenAI; model: string }[] = [];

  if (userCfg) {
    chain.push({
      name: 'custom',
      client: new OpenAI({ apiKey: userCfg.apiKey, baseURL: userCfg.baseURL }),
      model: userCfg.model,
    });
  }

  // 预算外只允许免费回退，不再列入付费兜底（nvidia 等）
  const fallbackOrder = opts?.budgetOk === false ? ['siliconflow'] : FALLBACK_ORDER;

  const primary = getPrimaryProvider();
  const ordered = [primary, ...fallbackOrder.filter((p) => p !== primary)];

  for (const name of ordered) {
    const apiKey = resolveApiKey(name);
    if (!apiKey) continue;

    const defaults = PROVIDER_DEFAULTS[name] ?? PROVIDER_DEFAULTS.openai;
    const isPrimary = name === primary;
    const baseURL = isPrimary ? process.env.AI_BASE_URL ?? defaults.baseURL : defaults.baseURL;
    const model = defaultModelFor(name, opts);

    chain.push({ name, client: new OpenAI({ apiKey, baseURL }), model });
  }

  return chain;
}
