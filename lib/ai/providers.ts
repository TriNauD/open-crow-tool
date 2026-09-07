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

/** 单次 AI 调用的默认超时：SDK 默认约 10 分钟，主通道「挂起不报错」时 fallback 链形同虚设 */
const DEFAULT_PROVIDER_TIMEOUT_MS = 18_000;
/** 允许 AI 慢流式输出；超时只约束「发起调用到开始返回」的阶段，拿到流后不再计时 */
export const AI_CONNECT_TIMEOUT_ERROR = 'AI_CONNECT_TIMEOUT';

export function getPrimaryProvider(): string {
  return (process.env.AI_PROVIDER ?? 'siliconflow').toLowerCase();
}

export function getProviderTimeoutMs(): number {
  const raw = Number(process.env.AI_PROVIDER_TIMEOUT_MS);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_PROVIDER_TIMEOUT_MS;
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

  // maxRetries: 0——重试交给 fallback 链；SDK 自带重试会把「挂起 provider」的代价放大成 timeout × (retries+1)
  return new OpenAI({ apiKey, baseURL, maxRetries: 0 });
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
      client: new OpenAI({ apiKey: userCfg.apiKey, baseURL: userCfg.baseURL, maxRetries: 0 }),
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

    chain.push({ name, client: new OpenAI({ apiKey, baseURL, maxRetries: 0 }), model });
  }

  return chain;
}

/**
 * 给单次 AI 调用加超时：超时即 abort 底层请求并抛出带 AI_CONNECT_TIMEOUT 标记的错误，
 * 调用方（fallback 循环）据此切换下一 provider。
 * - 流式调用：fn resolve（响应头已到、开始出流）即停止计时，不限制流式输出时长；
 * - 非流式调用：fn resolve 即完整响应已返回，超时覆盖整个请求。
 */
export async function withProviderTimeout<T>(
  timeoutMs: number,
  fn: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return fn(new AbortController().signal);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fn(controller.signal);
  } catch (err) {
    if (controller.signal.aborted) {
      const wrapped = new Error(`AI 提供方 ${Math.round(timeoutMs / 1000)}s 内未响应，已中断`);
      (wrapped as Error & { code?: string }).code = AI_CONNECT_TIMEOUT_ERROR;
      throw wrapped;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** 判断错误是否为 withProviderTimeout 产生的连接超时（用于日志区分「挂起」与「真报错」） */
export function isProviderTimeoutError(err: unknown): boolean {
  return (err as { code?: string } | null | undefined)?.code === AI_CONNECT_TIMEOUT_ERROR;
}

export interface ProviderChainEntry {
  name: string;
  client: OpenAI;
  model: string;
}

/**
 * 依序尝试 fallback 链：第一个成功的 attempt 生效；全部失败时抛出最后一个错误。
 * attempt 内部应自行调用 withProviderTimeout 约束单次调用的时长。
 */
export async function runProviderChain<T>(
  chain: ProviderChainEntry[],
  attempt: (entry: ProviderChainEntry) => Promise<T>,
  onProviderError?: (name: string, err: unknown) => void
): Promise<{ value: T; providerName: string }> {
  let lastErr: unknown;
  for (const entry of chain) {
    try {
      return { value: await attempt(entry), providerName: entry.name };
    } catch (err) {
      lastErr = err;
      onProviderError?.(entry.name, err);
    }
  }
  throw lastErr ?? new Error('All AI providers failed');
}
