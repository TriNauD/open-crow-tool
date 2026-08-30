import type { TrendingRepo } from '@/lib/github-trending';

/**
 * Trending 抓取的「上次成功结果」缓存（ROADMAP R15）。
 * cheerio 依赖 GitHub 页面结构，改版即挂；抓取失败或列表为空时用上次成功结果
 * 降级发送周报，并在运维邮件中标记 degraded。
 *
 * 存储走 Upstash Redis（与限流共用配置，serverless 多实例共享）；
 * 未配置或读写失败一律 fail-open：不缓存、不兜底，行为退回「中止 + 告警」。
 */

const CACHE_KEY = 'crow:trending:weekly:last';

interface TrendingCachePayload {
  savedAtIso: string;
  repos: TrendingRepo[];
}

function upstashConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function upstash(command: string, ...args: string[]): Promise<string | null> {
  const base = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/+$/, '');
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!base || !token) return null;
  const path = args.map(encodeURIComponent).join('/');
  try {
    const res = await fetch(`${base}/${command}${path ? `/${path}` : ''}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: string };
    return typeof data.result === 'string' ? data.result : null;
  } catch {
    return null;
  }
}

/** 抓取成功后刷新缓存；失败静默（缓存只是兜底，不应影响主流程） */
export async function saveTrendingCache(repos: TrendingRepo[]): Promise<void> {
  if (!upstashConfigured() || repos.length === 0) return;
  const payload: TrendingCachePayload = { savedAtIso: new Date().toISOString(), repos };
  await upstash('set', CACHE_KEY, JSON.stringify(payload));
}

export interface TrendingCacheHit {
  savedAtIso: string;
  repos: TrendingRepo[];
}

/** 读取上次成功结果；未配置 / 无缓存 / 解析失败返回 null */
export async function loadTrendingCache(): Promise<TrendingCacheHit | null> {
  if (!upstashConfigured()) return null;
  const raw = await upstash('get', CACHE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as TrendingCachePayload;
    if (!Array.isArray(parsed.repos) || parsed.repos.length === 0 || !parsed.savedAtIso) {
      return null;
    }
    return { savedAtIso: parsed.savedAtIso, repos: parsed.repos };
  } catch {
    return null;
  }
}
