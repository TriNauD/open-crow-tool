/**
 * 请求守卫：按 IP 限流 + Origin 校验。
 *
 * 限流为固定窗口计数：
 * - 配置了 UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN 时走 Upstash Redis
 *   （Vercel serverless 多实例共享计数；本地内存 Map 在 serverless 上形同虚设）。
 * - 未配置或 Upstash 请求失败时退回进程内 Map（fail-open：只影响限流精度，不影响可用性）。
 */

const UPSTASH_WINDOW_PREFIX = 'crow:rl';

const memoryMap = new Map<string, { count: number; resetAt: number }>();
/** 内存兜底的最大条目数，超过即清一轮过期，防 Map 无限膨胀 */
const MEMORY_MAX_ENTRIES = 10_000;

/** 单日预算记账：key 含日期，跨天自然重置 */
const BUDGET_PREFIX = 'crow:budget';
const BUDGET_MEMORY_MAP = new Map<string, number>();
/** 内存预算条目的最大数量 */
const BUDGET_MEMORY_MAX_ENTRIES = 10_000;

/** 默认单人单日预算（元），可用 EXPLAIN_DAILY_BUDGET_CNY 调整 */
const DEFAULT_DAILY_BUDGET_CNY = 2;

function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export type RateLimitResult = {
  ok: boolean;
  /** 被拒时距窗口重置的秒数，用于 Retry-After */
  retryAfterSec: number;
  /** 实际使用的存储，便于日志排查 */
  backend: 'upstash' | 'memory';
};

export function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) {
    const first = fwd.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip')?.trim() || 'unknown';
}

function upstashConfigured(): boolean {
  return Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

async function upstashCommand(command: string, ...args: string[]): Promise<number | null> {
  const base = process.env.UPSTASH_REDIS_REST_URL?.replace(/\/+$/, '');
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!base || !token) return null;
  const path = args.map(encodeURIComponent).join('/');
  try {
    const res = await fetch(`${base}/${command}${path ? `/${path}` : ''}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      // 限流探测不應拖慢主请求
      signal: AbortSignal.timeout(1500),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: number | string };
    const n = typeof data.result === 'string' ? Number(data.result) : data.result;
    return typeof n === 'number' && Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function memoryHit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  if (memoryMap.size > MEMORY_MAX_ENTRIES) {
    for (const [k, v] of memoryMap) {
      if (now > v.resetAt) memoryMap.delete(k);
    }
  }

  const entry = memoryMap.get(key);
  if (!entry || now > entry.resetAt) {
    memoryMap.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0, backend: 'memory' };
  }
  if (entry.count >= limit) {
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
      backend: 'memory',
    };
  }
  entry.count++;
  return { ok: true, retryAfterSec: 0, backend: 'memory' };
}

/**
 * 固定窗口限流。scope 区分接口（如 'explain' / 'fetch-url'）。
 * 供单测隔离内存态使用。
 */
export async function checkRateLimit(
  scope: string,
  ip: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  if (limit <= 0 || windowMs <= 0) {
    return { ok: true, retryAfterSec: 0, backend: 'memory' };
  }

  const key = `${UPSTASH_WINDOW_PREFIX}:${scope}:${ip}`;

  if (upstashConfigured()) {
    const count = await upstashCommand('incr', key);
    if (count !== null) {
      if (count === 1) {
        // 仅首个请求设置过期，避免重复刷新窗口
        await upstashCommand('pexpire', key, String(windowMs));
      }
      if (count > limit) {
        const ttl = await upstashCommand('pttl', key);
        const retryAfterSec =
          ttl !== null && ttl > 0 ? Math.max(1, Math.ceil(ttl / 1000)) : Math.ceil(windowMs / 1000);
        return { ok: false, retryAfterSec, backend: 'upstash' };
      }
      return { ok: true, retryAfterSec: 0, backend: 'upstash' };
    }
    // Upstash 不可用 → 内存兜底（fail-open）
  }

  return memoryHit(key, limit, windowMs);
}

/** 仅供单测清空内存计数 */
export function resetRateLimitMemory(): void {
  memoryMap.clear();
}

function budgetKey(scope: string, ip: string): string {
  return `${BUDGET_PREFIX}:${scope}:${todayKey()}:${ip}`;
}

async function budgetUsed(key: string): Promise<number> {
  if (upstashConfigured()) {
    return (await upstashCommand('get', key)) ?? 0;
  }
  return BUDGET_MEMORY_MAP.get(key) ?? 0;
}

async function budgetAdd(key: string, amount: number): Promise<void> {
  if (upstashConfigured()) {
    await upstashCommand('incrbyfloat', key, String(amount));
    return;
  }
  if (BUDGET_MEMORY_MAP.size > BUDGET_MEMORY_MAX_ENTRIES) {
    BUDGET_MEMORY_MAP.clear();
  }
  BUDGET_MEMORY_MAP.set(key, (BUDGET_MEMORY_MAP.get(key) ?? 0) + amount);
}

async function budgetSet(key: string, amount: number): Promise<void> {
  if (upstashConfigured()) {
    await upstashCommand('set', key, String(amount));
    return;
  }
  BUDGET_MEMORY_MAP.set(key, amount);
}

export type BudgetDecision = {
  /** 是否走付费档（预算未超）；false 时用免费模型 */
  premium: boolean;
  /** 今日剩余预算（元，预估口径） */
  remaining: number;
};

/**
 * 单人单日预算路由：预算未超 → 付费档；已超 → 免费档。
 * 选档用预估费用判断；实际结算由 budgetSettle 修正账面。
 */
export async function budgetDecide(
  scope: string,
  ip: string,
  estimatedCostCny: number,
  dailyBudgetCny: number = DEFAULT_DAILY_BUDGET_CNY
): Promise<BudgetDecision> {
  const key = budgetKey(scope, ip);
  const used = await budgetUsed(key);
  const remaining = Math.max(0, dailyBudgetCny - used);
  // 预估恰好占满预算也算可走付费档
  return {
    premium: used + estimatedCostCny <= dailyBudgetCny + 1e-9,
    remaining,
  };
}

/** 走付费档后先落预估费用（预算内），串行化由限流窗口兜着 */
export async function budgetReserve(scope: string, ip: string, costCny: number): Promise<void> {
  await budgetAdd(budgetKey(scope, ip), costCny);
}

/** 流结束后按真实 usage 结算：补记「实际 - 预估」差额，超支最多到 +2 元 */
export async function budgetSettle(
  scope: string,
  ip: string,
  actualCostCny: number,
  reservedCostCny: number
): Promise<void> {
  const key = budgetKey(scope, ip);
  const used = await budgetUsed(key);
  const adjusted = Math.max(0, used - reservedCostCny + actualCostCny);
  await budgetSet(key, adjusted);
}

/**
 * Origin 校验（纵深防御，挡浏览器侧跨站滥用；curl 等无 Origin 的直连交给限流管）：
 * - 无 Origin：放行（curl / 服务端调用；浏览器对 POST 请求总会带 Origin）
 * - 与请求同源：放行
 * - chrome-extension:// 扩展：放行
 * - 其余（任意第三方网页）：拒绝
 */
export function isOriginAllowed(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true;

  let originHost: string;
  try {
    originHost = new URL(origin).host.toLowerCase();
  } catch {
    return false;
  }

  if (origin.startsWith('chrome-extension://')) return true;

  try {
    if (new URL(req.url).host.toLowerCase() === originHost) return true;
  } catch {
    /* url 解析失败继续走拒绝 */
  }

  return false;
}
