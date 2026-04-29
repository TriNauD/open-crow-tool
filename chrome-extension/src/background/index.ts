import type { CrowAuth } from '../lib/crow-session';
import { CROW_AUTH_BROADCAST_EVENT } from '../lib/crow-auth-event';
import { performSupabaseRefreshExchange } from '../lib/supabase-refresh-exchange';

async function deliverAuthToTab(tabId: number, auth: CrowAuth | undefined): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'CROW_AUTH_UPDATED', auth });
    return;
  } catch {
    /* receiving end may not exist yet */
  }
  if (!auth?.accessToken || !auth?.apiBaseUrl) return;
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (eventName: string, detail: CrowAuth) => {
        window.dispatchEvent(new CustomEvent(eventName, { detail }));
      },
      args: [CROW_AUTH_BROADCAST_EVENT, auth],
    });
  } catch {
    /* e.g. chrome:// or restricted page */
  }
}

/** 网站「连接插件」写入 storage 后，通知所有标签页更新会话（优先 sendMessage；无接收端时用 scripting 派发自定义事件） */
async function broadcastAuthUpdatedToAllTabs(auth?: CrowAuth): Promise<void> {
  try {
    const tabs = await chrome.tabs.query({});
    for (const t of tabs) {
      if (t.id != null) await deliverAuthToTab(t.id, auth);
    }
  } catch {
    /* ignore */
  }
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== 'explain-selection') return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;

  chrome.tabs.sendMessage(tab.id, { type: 'CROW_EXPLAIN' });
});

/** content / options 划词保存前 refresh：在 SW 内 fetch，避免第三方页面 Origin 拖累 Supabase token 端点 */
chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse): boolean => {
  const raw = message as { type?: string; payload?: Record<string, unknown> };
  if (raw?.type === 'CROW_DEBUG_FAB') {
    // #region agent log
    fetch('http://127.0.0.1:7254/ingest/d81ae450-4ef0-4188-89ac-154a7304bd7d', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '821123' },
      body: JSON.stringify({ sessionId: '821123', ...raw.payload }),
    }).catch(() => {});
    // #endregion
    return false;
  }

  const msg = message as {
    type?: string;
    supabaseUrl?: string;
    supabaseAnonKey?: string;
    refreshToken?: string;
  };
  if (msg?.type === 'CROW_BROADCAST_AUTH_RELOAD') {
    const full = message as { type?: string; auth?: CrowAuth };
    void broadcastAuthUpdatedToAllTabs(full.auth);
    return false;
  }
  if (msg?.type !== 'CROW_EXCHANGE_REFRESH') {
    return false;
  }

  void performSupabaseRefreshExchange(
    msg.supabaseUrl ?? '',
    msg.supabaseAnonKey ?? '',
    msg.refreshToken ?? ''
  )
    .then((r) => {
      if (r) {
        sendResponse({
          ok: true as const,
          access_token: r.access_token,
          refresh_token: r.refresh_token,
          expires_at: r.expires_at,
        });
      } else {
        sendResponse({ ok: false as const });
      }
    })
    .catch(() => {
      sendResponse({ ok: false as const });
    });

  return true;
});
