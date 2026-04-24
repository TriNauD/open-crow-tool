import OpenAI from 'openai';

const PROVIDER_DEFAULTS: Record<string, { baseURL: string; model: string }> = {
  openai:      { baseURL: 'https://api.openai.com/v1',           model: 'gpt-4o' },
  siliconflow: { baseURL: 'https://api.siliconflow.cn/v1',       model: 'deepseek-ai/DeepSeek-V3' },
  /** NVIDIA build / NIM hosted chat (OpenAI-compatible) */
  nvidia:      { baseURL: 'https://integrate.api.nvidia.com/v1', model: 'meta/llama-3.3-70b-instruct' },
};

export function getPrimaryProvider(): string {
  return (process.env.AI_PROVIDER ?? 'openai').toLowerCase();
}

export function getOpenAIForProvider(provider: string): OpenAI {
  const p = provider.toLowerCase();
  const defaults = PROVIDER_DEFAULTS[p] ?? PROVIDER_DEFAULTS.openai;

  const baseURL =
    p === getPrimaryProvider()
      ? process.env.AI_BASE_URL ?? defaults.baseURL
      : defaults.baseURL;

  let apiKey: string | undefined;

  if (p === 'nvidia') {
    apiKey = process.env.NVIDIA_API_KEY ?? process.env.AI_API_KEY;
  } else if (p === 'siliconflow') {
    apiKey = process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY;
  } else {
    apiKey = process.env.AI_API_KEY ?? process.env.OPENAI_API_KEY;
  }

  return new OpenAI({ apiKey, baseURL });
}

export function getModelForProvider(provider: string): string {
  const p = provider.toLowerCase();
  const defaults = PROVIDER_DEFAULTS[p] ?? PROVIDER_DEFAULTS.openai;

  if (p === 'nvidia') {
    return process.env.NVIDIA_MODEL ?? defaults.model;
  }

  return (
    process.env.AI_MODEL ?? process.env.OPENAI_MODEL ?? defaults.model
  );
}

export function isNvidiaFallbackEnabled(): boolean {
  const v = (process.env.AI_ENABLE_NVIDIA_FALLBACK ?? '').toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export function getNvidiaOpenAI(): OpenAI {
  const defaults = PROVIDER_DEFAULTS.nvidia;
  return new OpenAI({
    apiKey: process.env.NVIDIA_API_KEY,
    baseURL: process.env.NVIDIA_BASE_URL ?? defaults.baseURL,
  });
}

export function getNvidiaModel(): string {
  return process.env.NVIDIA_MODEL ?? PROVIDER_DEFAULTS.nvidia.model;
}
