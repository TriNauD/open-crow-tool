import type { CrowAuth } from '../lib/crow-session';
import { CROW_AUTH_BROADCAST_EVENT } from '../lib/crow-auth-event';

export { CROW_AUTH_BROADCAST_EVENT };

/** 连接站点广播会话时，若 React 尚未订阅，先缓存一条，避免丢消息 */
let pendingCrowAuth: CrowAuth | undefined;

/** SW executeScript 只派发事件时：同步写入 pending，供 App mount 后 drain */
window.addEventListener(CROW_AUTH_BROADCAST_EVENT, (e: Event) => {
  pendingCrowAuth = (e as CustomEvent<CrowAuth | undefined>).detail;
});

chrome.runtime.onMessage.addListener((message: { type?: string; auth?: CrowAuth }) => {
  if (message?.type !== 'CROW_AUTH_UPDATED') return;
  pendingCrowAuth = message.auth;
  window.dispatchEvent(new CustomEvent(CROW_AUTH_BROADCAST_EVENT, { detail: message.auth }));
});

/** App mount 时拉取早到的广播（若 onMessage 已触发且当时无 window 监听） */
export function drainPendingCrowAuth(): CrowAuth | undefined {
  const x = pendingCrowAuth;
  pendingCrowAuth = undefined;
  return x;
}

/** window 监听内与 drain 共用：避免同一条既走 event 又走 pending */
export function clearPendingCrowAuth(): void {
  pendingCrowAuth = undefined;
}
