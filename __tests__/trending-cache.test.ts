import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadTrendingCache, saveTrendingCache } from '@/lib/trending-cache';
import type { TrendingRepo } from '@/lib/github-trending';

const CACHE_ENV_KEYS = ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'] as const;

function makeRepo(name = 'a/b'): TrendingRepo {
  return {
    name,
    url: `https://github.com/${name}`,
    description: '描述',
    language: 'TS',
    totalStars: 100,
    weeklyStars: 10,
  };
}

describe('trending-cache（R15 抓取降级缓存）', () => {
  beforeEach(() => {
    for (const k of CACHE_ENV_KEYS) delete process.env[k];
  });

  afterEach(() => {
    for (const k of CACHE_ENV_KEYS) delete process.env[k];
    vi.unstubAllGlobals();
  });

  it('未配置 Upstash 时：save 不发请求、load 返回 null（fail-open）', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await saveTrendingCache([makeRepo()]);
    expect(await loadTrendingCache()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('save 写入 JSON 负载（含 savedAtIso），load 原样读回', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'tok';

    const calls: string[] = [];
    let stored: string | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        calls.push(url);
        if (url.includes('/set/')) {
          // upstash REST 把参数编码在路径里：/set/<key>/<value>
          stored = decodeURIComponent(url.split('/').pop() ?? '');
          return Response.json({ result: 'OK' });
        }
        return Response.json({ result: stored ?? null });
      })
    );

    await saveTrendingCache([makeRepo('x/y')]);
    const hit = await loadTrendingCache();

    expect(calls[0]).toContain('/set/');
    expect(hit).not.toBeNull();
    expect(hit?.savedAtIso).toBeTruthy();
    expect(hit?.repos).toHaveLength(1);
    expect(hit?.repos[0].name).toBe('x/y');
  });

  it('缓存内容损坏 / 列表为空时 load 返回 null', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'tok';

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ result: 'not-json{{' }))
    );
    expect(await loadTrendingCache()).toBeNull();

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ result: JSON.stringify({ savedAtIso: 'x', repos: [] }) }))
    );
    expect(await loadTrendingCache()).toBeNull();
  });

  it('空列表不写缓存；Upstash 网络异常静默', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://redis.example.upstash.io';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'tok';

    const fetchMock = vi.fn(async () => {
      throw new Error('network down');
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(saveTrendingCache([])).resolves.toBeUndefined();
    await expect(saveTrendingCache([makeRepo()])).resolves.toBeUndefined();
    expect(await loadTrendingCache()).toBeNull();
  });
});
