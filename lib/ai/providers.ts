import OpenAI from 'openai';

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
 * Build ordered provider chain: [primary, ...fallbacks].
 * Only includes providers that have an API key configured.
 */
export function getProviderChain(): { name: string; client: OpenAI; model: string }[] {
  const primary = getPrimaryProvider();
  const ordered = [primary, ...FALLBACK_ORDER.filter((p) => p !== primary)];

  const chain: { name: string; client: OpenAI; model: string }[] = [];

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
