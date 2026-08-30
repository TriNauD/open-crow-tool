import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  USER_LLM_CONFIG_HEADER,
  getProviderChain,
  parseUserLLMConfig,
  type UserLLMConfig,
} from '@/lib/ai/providers';

function encodeCfg(cfg: unknown): string {
  const json = JSON.stringify(cfg);
  const b64 = Buffer.from(json, 'utf8').toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

const VALID_CFG: UserLLMConfig = {
  baseURL: 'https://api.deepseek.com/v1',
  apiKey: 'sk-test-123',
  model: 'deepseek-chat',
};

/** 保存 env，测试后恢复，避免污染其他用例 */
const ENV_KEYS = ['AI_PROVIDER', 'AI_API_KEY', 'AI_BASE_URL', 'AI_MODEL'] as const;
let savedEnv: Record<string, string | undefined> = {};

describe('parseUserLLMConfig（X-Crow-LLM-Config 解析与校验）', () => {
  it('合法 https 配置可解析，去尾部斜杠', () => {
    const parsed = parseUserLLMConfig(encodeCfg({ ...VALID_CFG, baseURL: 'https://api.deepseek.com/v1/' }));
    expect(parsed).toEqual(VALID_CFG);
  });

  it('空值 / 乱码 / 非对象 JSON 返回 null', () => {
    expect(parseUserLLMConfig(null)).toBeNull();
    expect(parseUserLLMConfig('')).toBeNull();
    expect(parseUserLLMConfig('not-base64!!')).toBeNull();
    expect(parseUserLLMConfig(encodeCfg('just a string'))).toBeNull();
    expect(parseUserLLMConfig(encodeCfg({ baseURL: 'https://x.com/v1' }))).toBeNull();
  });

  it('超长字段返回 null', () => {
    const long = { ...VALID_CFG, apiKey: 'k'.repeat(300) };
    expect(parseUserLLMConfig(encodeCfg(long))).toBeNull();
  });

  it('http（非本机）返回 null', () => {
    const parsed = parseUserLLMConfig(encodeCfg({ ...VALID_CFG, baseURL: 'http://api.deepseek.com/v1' }));
    expect(parsed).toBeNull();
  });

  it('https 私网 / localhost 地址返回 null（SSRF 拦截）', () => {
    expect(parseUserLLMConfig(encodeCfg({ ...VALID_CFG, baseURL: 'https://127.0.0.1/v1' }))).toBeNull();
    expect(parseUserLLMConfig(encodeCfg({ ...VALID_CFG, baseURL: 'https://192.168.1.10/v1' }))).toBeNull();
    expect(parseUserLLMConfig(encodeCfg({ ...VALID_CFG, baseURL: 'https://localhost/v1' }))).toBeNull();
  });

  it('开发环境放行 http://localhost（本地自托管联调）', () => {
    const parsed = parseUserLLMConfig(encodeCfg({ ...VALID_CFG, baseURL: 'http://localhost:11434/v1' }));
    expect(parsed?.baseURL).toBe('http://localhost:11434/v1');
  });
});

describe('getProviderChain（用户配置优先 + 失败回退 env 链）', () => {
  beforeEach(() => {
    savedEnv = {};
    for (const k of ENV_KEYS) {
      savedEnv[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (savedEnv[k] === undefined) delete process.env[k];
      else process.env[k] = savedEnv[k];
    }
  });

  it('无用户配置时行为不变：仅 env 有 key 的 provider 入链', () => {
    process.env.AI_PROVIDER = 'siliconflow';
    process.env.AI_API_KEY = 'env-key';
    const chain = getProviderChain(null);
    expect(chain.map((p) => p.name)).toEqual(['siliconflow']);
  });

  it('有用户配置时 custom 排最前，env 链兜底在后', () => {
    process.env.AI_PROVIDER = 'siliconflow';
    process.env.AI_API_KEY = 'env-key';
    const chain = getProviderChain(VALID_CFG);
    expect(chain.map((p) => p.name)).toEqual(['custom', 'siliconflow']);
    expect(chain[0].model).toBe('deepseek-chat');
    expect(chain[0].client.baseURL).toContain('api.deepseek.com');
  });

  it('env 全空时只有 custom 可用；无用户配置且 env 全空则链为空', () => {
    expect(getProviderChain(VALID_CFG).map((p) => p.name)).toEqual(['custom']);
    expect(getProviderChain(null)).toEqual([]);
  });
});

describe('CORS / 常量约定', () => {
  it('请求头名为小写 x-crow-llm-config，与 cors 白名单一致', async () => {
    expect(USER_LLM_CONFIG_HEADER).toBe('x-crow-llm-config');
    const { corsHeaders } = await import('@/lib/utils/cors');
    expect(corsHeaders['Access-Control-Allow-Headers']).toContain('x-crow-llm-config');
    expect(corsHeaders['Access-Control-Expose-Headers']).toContain('x-crow-provider');
  });
});
