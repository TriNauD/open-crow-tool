/**
 * 用户自配 LLM（OpenAI-compatible）的浏览器端存储与编码。
 * Key 只存 localStorage，不落服务器；每次请求经 X-Crow-LLM-Config 头透传。
 */

export const USER_LLM_STORAGE_KEY = 'crow.userLlmConfig';

export const USER_LLM_CONFIG_HEADER = 'x-crow-llm-config';
export const EFFECTIVE_PROVIDER_HEADER = 'x-crow-provider';

export type StoredUserLLMConfig = {
  baseURL: string;
  apiKey: string;
  model: string;
};

const LIMITS = { baseURL: 300, apiKey: 256, model: 120 };

/** 保存前的轻量校验；服务端会再完整校验（https、私网拦截等），这里不过关就存不了 */
export function normalizeUserLLMInput(input: {
  baseURL: string;
  apiKey: string;
  model: string;
}): StoredUserLLMConfig | null {
  const baseURL = input.baseURL.trim().replace(/\/+$/, '');
  const apiKey = input.apiKey.trim();
  const model = input.model.trim();
  if (!baseURL || !apiKey || !model) return null;
  if (
    baseURL.length > LIMITS.baseURL ||
    apiKey.length > LIMITS.apiKey ||
    model.length > LIMITS.model
  ) {
    return null;
  }
  if (!/^https?:\/\//i.test(baseURL)) return null;
  return { baseURL, apiKey, model };
}

export function loadStoredUserLLMConfig(): StoredUserLLMConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(USER_LLM_STORAGE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw) as Partial<StoredUserLLMConfig>;
    if (
      typeof obj.baseURL !== 'string' ||
      !obj.baseURL ||
      typeof obj.apiKey !== 'string' ||
      !obj.apiKey ||
      typeof obj.model !== 'string' ||
      !obj.model
    ) {
      return null;
    }
    return { baseURL: obj.baseURL, apiKey: obj.apiKey, model: obj.model };
  } catch {
    return null;
  }
}

export function saveStoredUserLLMConfig(cfg: StoredUserLLMConfig): void {
  window.localStorage.setItem(USER_LLM_STORAGE_KEY, JSON.stringify(cfg));
}

export function clearStoredUserLLMConfig(): void {
  window.localStorage.removeItem(USER_LLM_STORAGE_KEY);
}

/** JSON → base64url，供 X-Crow-LLM-Config 头透传（服务端同规则解码） */
export function encodeUserLLMConfigHeader(cfg: StoredUserLLMConfig): string {
  const bytes = new TextEncoder().encode(JSON.stringify(cfg));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
