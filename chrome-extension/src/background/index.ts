import type { CrowAuth } from '../lib/crow-session';
import { CROW_AUTH_BROADCAST_EVENT } from '../lib/crow-auth-event';
import { CROW_EXTENSION_ENABLED_KEY } from '../lib/crow-session';
import { performSupabaseRefreshExchange } from '../lib/supabase-refresh-exchange';

/**
 * 扩展安装或重载时，将 content script 主动注入到已开着的旧标签页。
 *
 * Chrome MV3 在扩展「首次安装」时会自动向所有已打开标签页注入声明式 content script，
 * 但在开发模式「重新加载」时并不保证重新注入，导致旧标签页需要手动刷新。
 * 通过 onInstalled 主动注入可解决这一问题。
 *
 * 注意：Chrome 自动注入与此处注入可能同时发生（首次安装时），
 * content script 内部已用 window 标志位防止重复初始化。
 */
chrome.runtime.onInstalled.addListener(async () => {
  const manifest = chrome.runtime.getManifest();
  // 从构建后的 manifest 动态取 content script 文件路径（crxjs 构建含 hash，不可硬编码）
  const contentScriptFiles = manifest.content_scripts?.flatMap((cs) => cs.js ?? []) ?? [];
  if (!contentScriptFiles.length) return;

  let tabs: chrome.tabs.Tab[] = [];
  try {
    tabs = await chrome.tabs.query({});
  } catch {
    return;
  }

  for (const tab of tabs) {
    if (!tab.id || !tab.url) continue;
    // 跳过扩展自身页面及受限协议（file:// 需额外权限，一并跳过）
    if (/^(chrome|chrome-extension|edge|about|data|file):/.test(tab.url)) continue;
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        files: contentScriptFiles,
      });
    } catch {
      /* 页面受限或已卸载，忽略 */
    }
  }
});

async function deliverAuthToTab(tabId: number, auth: CrowAuth | undefined): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'CROW_AUTH_UPDATED', auth });
  } catch {
    /* receiving end may not exist yet */
  }
  /* all_frames 注入下 sendMessage 可能只命中某一子帧，主帧 App 会收不到；须向每一帧投递同一事件 */
  try {
    await chrome.scripting.executeScript({
      target: { tabId, allFrames: true },
      func: (eventName: string, detail: CrowAuth | null) => {
        window.dispatchEvent(
          new CustomEvent(eventName, { detail: detail === null ? undefined : detail })
        );
      },
      args: [CROW_AUTH_BROADCAST_EVENT, auth ?? null],
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

  const raw = await chrome.storage.local.get([CROW_EXTENSION_ENABLED_KEY]);
  if (raw[CROW_EXTENSION_ENABLED_KEY] === false) return;

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
