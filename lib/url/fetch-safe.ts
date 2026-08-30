import dns from 'node:dns/promises';
import net from 'node:net';

export const FETCH_TIMEOUT_MS = 5000;
export const FETCH_MAX_BYTES = 512 * 1024;
export const FETCH_MAX_REDIRECTS = 3;
export const FETCH_MAX_TEXT_CHARS = 12_000;

export type FetchSafeErrorCode =
  | 'INVALID_URL'
  | 'SSRF_BLOCKED'
  | 'TIMEOUT'
  | 'TOO_LARGE'
  | 'UNSUPPORTED_TYPE'
  | 'HTTP_ERROR'
  | 'EMPTY';

export class FetchSafeError extends Error {
  constructor(
    public code: FetchSafeErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'FetchSafeError';
  }
}

export function isPrivateOrReservedIp(ip: string): boolean {
  if (net.isIP(ip) === 0) return true;

  if (net.isIP(ip) === 6) {
    const lower = ip.toLowerCase();
    if (lower === '::1') return true;
    if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // ULA
    if (lower.startsWith('fe80')) return true; // link-local
    if (lower === '::' || lower.startsWith('::ffff:')) {
      const v4 = lower.startsWith('::ffff:') ? lower.slice(7) : '';
      if (v4 && net.isIP(v4) === 4) return isPrivateOrReservedIp(v4);
    }
    return false;
  }

  const parts = ip.split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true; // multicast / reserved
  return false;
}

export function assertSafeHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new FetchSafeError('INVALID_URL', 'invalid url');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new FetchSafeError('SSRF_BLOCKED', 'only http/https allowed');
  }
  if (url.username || url.password) {
    throw new FetchSafeError('SSRF_BLOCKED', 'credentials in url not allowed');
  }
  const host = url.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host === 'metadata.google.internal'
  ) {
    throw new FetchSafeError('SSRF_BLOCKED', 'host blocked');
  }
  if (net.isIP(host) && isPrivateOrReservedIp(host)) {
    throw new FetchSafeError('SSRF_BLOCKED', 'private ip blocked');
  }
  return url;
}

/**
 * DNS 解析级校验：域名必须解析为公网 IP（防「公网域名解析到内网 IP」绕过
 * assertSafeHttpUrl 的字符串级检查）。IP 字面量直接判断；解析失败视为不通过。
 */
export async function assertHostResolvesPublic(hostname: string): Promise<void> {
  if (net.isIP(hostname)) {
    if (isPrivateOrReservedIp(hostname)) {
      throw new FetchSafeError('SSRF_BLOCKED', 'private ip blocked');
    }
    return;
  }
  let records: { address: string; family: number }[];
  try {
    records = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new FetchSafeError('INVALID_URL', 'dns lookup failed');
  }
  if (!records.length) {
    throw new FetchSafeError('INVALID_URL', 'dns empty');
  }
  for (const r of records) {
    if (isPrivateOrReservedIp(r.address)) {
      throw new FetchSafeError('SSRF_BLOCKED', 'resolved to private ip');
    }
  }
}

function stripHtml(html: string): { title: string; text: string } {
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = titleMatch?.[1]?.replace(/\s+/g, ' ').trim() ?? '';
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { title, text };
}

export type SafeFetchResult = {
  finalUrl: string;
  title: string;
  text: string;
  truncated: boolean;
};

export async function fetchUrlSafe(rawUrl: string): Promise<SafeFetchResult> {
  let current = assertSafeHttpUrl(rawUrl);
  await assertHostResolvesPublic(current.hostname);

  for (let hop = 0; hop <= FETCH_MAX_REDIRECTS; hop++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(current.toString(), {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'OpenCrowBot/1.0 (+https://github.com/TriNauD/open-crow-tool)',
          Accept: 'text/html,text/plain;q=0.9,*/*;q=0.1',
        },
      });
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new FetchSafeError('TIMEOUT', 'fetch timeout');
      }
      throw new FetchSafeError('HTTP_ERROR', 'fetch failed');
    } finally {
      clearTimeout(timer);
    }

    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get('location');
      if (!loc) throw new FetchSafeError('HTTP_ERROR', 'redirect without location');
      if (hop === FETCH_MAX_REDIRECTS) {
        throw new FetchSafeError('HTTP_ERROR', 'too many redirects');
      }
      current = assertSafeHttpUrl(new URL(loc, current).toString());
      await assertHostResolvesPublic(current.hostname);
      continue;
    }

    if (!res.ok) {
      throw new FetchSafeError('HTTP_ERROR', `http ${res.status}`);
    }

    const ctype = (res.headers.get('content-type') ?? '').toLowerCase();
    if (
      ctype &&
      !ctype.includes('text/html') &&
      !ctype.includes('text/plain') &&
      !ctype.includes('application/xhtml')
    ) {
      throw new FetchSafeError('UNSUPPORTED_TYPE', 'unsupported content-type');
    }

    const buf = await res.arrayBuffer();
    if (buf.byteLength > FETCH_MAX_BYTES) {
      throw new FetchSafeError('TOO_LARGE', 'response too large');
    }
    const raw = new TextDecoder('utf-8', { fatal: false }).decode(buf);
    const { title, text: extracted } = ctype.includes('text/plain')
      ? { title: '', text: raw.replace(/\s+/g, ' ').trim() }
      : stripHtml(raw);

    if (!extracted) {
      throw new FetchSafeError('EMPTY', 'no extractable text');
    }

    const truncated = extracted.length > FETCH_MAX_TEXT_CHARS;
    return {
      finalUrl: current.toString(),
      title,
      text: truncated ? extracted.slice(0, FETCH_MAX_TEXT_CHARS) : extracted,
      truncated,
    };
  }

  throw new FetchSafeError('HTTP_ERROR', 'too many redirects');
}
