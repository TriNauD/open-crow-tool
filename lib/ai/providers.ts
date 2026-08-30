import OpenAI from 'openai';
import { assertHostResolvesPublic, assertSafeHttpUrl } from '@/lib/url/fetch-safe';

/** 透传用户自配 LLM（OpenAI-compatible）的请求头名，值为 base64url(JSON) */
export const USER_LLM_CONFIG_HEADER = 'x-crow-llm-config';

/** 实际生效的 provider 名，随响应头返回，供「测试连接」判断回退 */
export const EFFECTIVE_PROVIDER_HEADER = 'x-crow-provider';

const USER_LLM_CONFIG_HEADER_MAX = 1024;
const USER_LLM_LIMITS = { baseURL: 300, apiKey: 256, model: 120 };

export type UserLLMConfig = { baseURL: string; apiKey: string; model: string };

const PROVIDER_DEFAULTS: Record<string, { baseURL: string; model: string }> = {
  openai:      { baseURL: 'https://api.openai.com/v1',              model: 'gpt-4o' },
  siliconflow: { baseURL: 'https://api.siliconflow.cn/v1',          model: 'deepseek-ai/DeepSeek-V4-Flash' },
  nvidia:      { baseURL: 'https://integrate.api.nvidia.com/v1',    model: 'meta/llama-3.3-70b-instruct' },
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

export function getModelForProvider(provider: string): string {
  const p = provider.toLowerCase();
  const defaults = PROVIDER_DEFAULTS[p] ?? PROVIDER_DEFAULTS.openai;

  if (p === getPrimaryProvider()) {
    return process.env.AI_MODEL ?? process.env.OPENAI_MODEL ?? defaults.model;
  }

  if (p === 'nvidia') return process.env.NVIDIA_MODEL ?? defaults.model;

  return defaults.model;
}

/**
 * 解析并校验用户自配的 LLM 配置（来自 X-Crow-LLM-Config 头，base64url JSON）。
 * 任何不合法（格式、长度、非 https、私网/内网地址、DNS 解析到内网 IP）一律返回 null，
 * 调用方静默忽略并走服务器默认 provider 链，不给用户报错。
 */
export async function parseUserLLMConfig(
  raw: string | null | undefined
): Promise<UserLLMConfig | null> {
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
      // DNS 解析级校验：公网域名解析到私网/保留 IP（DNS rebinding、内网映射）也拒绝
      await assertHostResolvesPublic(parsed.hostname);
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
  userCfg?: UserLLMConfig | null
): { name: string; client: OpenAI; model: string }[] {
  const chain: { name: string; client: OpenAI; model: string }[] = [];

  if (userCfg) {
    chain.push({
      name: 'custom',
      client: new OpenAI({ apiKey: userCfg.apiKey, baseURL: userCfg.baseURL }),
      model: userCfg.model,
    });
  }

  const primary = getPrimaryProvider();
  const ordered = [primary, ...FALLBACK_ORDER.filter((p) => p !== primary)];

  for (const name of ordered) {
    const apiKey = resolveApiKey(name);
    if (!apiKey) continue;

    const defaults = PROVIDER_DEFAULTS[name] ?? PROVIDER_DEFAULTS.openai;
    const isPrimary = name === primary;
    const baseURL = isPrimary ? process.env.AI_BASE_URL ?? defaults.baseURL : defaults.baseURL;
    const model = getModelForProvider(name);

    chain.push({ name, client: new OpenAI({ apiKey, baseURL }), model });
  }

  return chain;
}
