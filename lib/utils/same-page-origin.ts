/**
 * 页面 postMessage 中携带的 base URL 与 event.origin 是否同源（用于扩展与网页桥接时防伪造；允许 prod ↔ localhost 切换为独立场景校验）。
 */
export function samePageOrigin(pageBaseUrl: string, eventOrigin: string): boolean {
  try {
    return new URL(pageBaseUrl).origin === new URL(eventOrigin).origin;
  } catch {
    return false;
  }
}
