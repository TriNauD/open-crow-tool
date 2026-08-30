/**
 * 用户自配 LLM（OpenAI-compatible）的扩展端存储与编码。
 * Key 只存 chrome.storage.local（不进 sync，避免敏感信息跨设备同步）；
 * 划词解释请求经 X-Crow-LLM-Config 头透传给站点后端。
 */

export const CROW_USER_LLM_KEY = 'crowUserLlmConfig';

export const CROW_USER_LLM_HEADER = 'x-crow-llm-config';

export type CrowUserLLMConfig = {
  baseURL: string;
  apiKey: string;
  model: string;
};

const LIMITS = { baseURL: 300, apiKey: 256, model: 120 };

export async function loadUserLlmConfig(): Promise<CrowUserLLMConfig | null> {
  const store = await chrome.storage.local.get(CROW_USER_LLM_KEY);
  return normalizeUserLlmConfig(store[CROW_USER_LLM_KEY]);
}

export function normalizeUserLlmConfig(raw: unknown): CrowUserLLMConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Partial<CrowUserLLMConfig>;
  if (
    typeof obj.baseURL !== 'string' ||
    !obj.baseURL.trim() ||
    typeof obj.apiKey !== 'string' ||
    !obj.apiKey.trim() ||
    typeof obj.model !== 'string' ||
    !obj.model.trim()
  ) {
    return null;
  }
  const baseURL = obj.baseURL.trim().replace(/\/+$/, '');
  const apiKey = obj.apiKey.trim();
  const model = obj.model.trim();
  if (
    baseURL.length > LIMITS.baseURL ||
    apiKey.length > LIMITS.apiKey ||
    model.length > LIMITS.model ||
    !/^https?:\/\//i.test(baseURL)
  ) {
    return null;
  }
  return { baseURL, apiKey, model };
}

export async function saveUserLlmConfig(cfg: CrowUserLLMConfig): Promise<void> {
  await chrome.storage.local.set({ [CROW_USER_LLM_KEY]: cfg });
}

export async function clearUserLlmConfig(): Promise<void> {
  await chrome.storage.local.remove(CROW_USER_LLM_KEY);
}

/** JSON → base64url，与站点后端 X-Crow-LLM-Config 解码规则一致 */
export function encodeUserLlmConfigHeader(cfg: CrowUserLLMConfig): string {
  const bytes = new TextEncoder().encode(JSON.stringify(cfg));
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
