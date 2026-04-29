/**
 * 页面 postMessage 中携带的 base URL 与 event.origin 是否同源（用于扩展与网页桥接时防伪造）。
 * 开发环境常见 localhost / 127.0.0.1 / ::1 互相访问，视为同一开发源（仍要求 protocol + port 一致）。
 */
const LOCAL_DEV_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

function isLocalDevHostname(hostname: string): boolean {
  return LOCAL_DEV_HOSTNAMES.has(hostname);
}

export function samePageOrigin(pageBaseUrl: string, eventOrigin: string): boolean {
  try {
    const base = new URL(pageBaseUrl);
    const ev = new URL(eventOrigin);
    if (base.origin === ev.origin) return true;
    if (base.protocol !== ev.protocol) return false;
    if (base.port !== ev.port) return false;
    if (isLocalDevHostname(base.hostname) && isLocalDevHostname(ev.hostname)) return true;
    return false;
  } catch {
    return false;
  }
}
