import { createRoot, type Root } from 'react-dom/client';
import './crow-auth-broadcast';
import { samePageOrigin } from '../../../lib/utils/same-page-origin';
import {
  extensionContextLikelyOk,
  isExtensionContextInvalidatedError,
} from '../lib/extension-context';
import { CROW_EXTENSION_ENABLED_KEY, persistCrowAuth, type CrowAuth } from '../lib/crow-session';
import App from './App';
import { STYLES } from './styles';

let reactRoot: Root | null = null;

// 「连接插件」桥接监听——必须在所有页面（含 Crow 自身站点）上运行，
// 因此放在 mount() 之外，不受 crowNative 标志影响。
window.addEventListener('message', (e: MessageEvent) => {
  // 不用 e.source === window 检查：MV3 isolated world 中两者是不同 Proxy，比较结果不可靠
  const data = e.data as {
    type?: string;
    accessToken?: string;
    refreshToken?: string;
    apiBaseUrl?: string;
    supabaseUrl?: string;
    supabaseAnonKey?: string;
    expiresAt?: number;
  };
  if (data?.type !== 'CROW_CONNECT_EXT') return;

  const { accessToken, apiBaseUrl } = data;
  if (!accessToken || !apiBaseUrl) return;
  if (!samePageOrigin(apiBaseUrl, e.origin)) return;

  const auth: CrowAuth = {
    accessToken,
    apiBaseUrl,
    refreshToken: (data.refreshToken as string) || '',
    supabaseUrl: (data.supabaseUrl as string) || '',
    supabaseAnonKey: (data.supabaseAnonKey as string) || '',
    expiresAt: typeof data.expiresAt === 'number' ? data.expiresAt : undefined,
  };

  void (async () => {
    try {
      if (!extensionContextLikelyOk()) return;
      await persistCrowAuth(auth);
      window.postMessage({ type: 'CROW_CONNECT_EXT_OK' }, '*');
      try {
        if (extensionContextLikelyOk()) {
          chrome.runtime.sendMessage({ type: 'CROW_BROADCAST_AUTH_RELOAD', auth });
        }
      } catch {
        /* ignore */
      }
    } catch (err) {
      if (!isExtensionContextInvalidatedError(err)) {
        console.warn('[Crow ext] connect bridge storage failed', err);
      }
    }
  })();
});

function mount() {
  // Crow 自身站点：不挂载浮动 UI（避免与原生界面冲突），但 connect 监听已在上方注册
  if (document.documentElement.dataset.crowNative === 'true') return;

  const existing = document.getElementById('crow-ext-host');
  if (existing) {
    // reactRoot 不为 null → 当前 context 已挂载，跳过重复挂载
    if (reactRoot) return;
    // reactRoot 为 null 但 DOM 节点存在 → 来自上一次 extension context 的孤立节点
    // （常见于开发时扩展重载，或标签页在扩展更新后被重新注入），清理后重新挂载
    existing.remove();
  }

  const host = document.createElement('div');
  host.id = 'crow-ext-host';
  host.style.cssText =
    'all: initial; position: fixed; top: 0; left: 0; width: 0; height: 0; z-index: 2147483647; pointer-events: none;';
  document.documentElement.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  const style = document.createElement('style');
  style.textContent = STYLES;
  shadow.appendChild(style);

  const container = document.createElement('div');
  shadow.appendChild(container);

  const root = createRoot(container);
  root.render(<App />);
  reactRoot = root;
}

function unmount() {
  if (reactRoot) {
    reactRoot.unmount();
    reactRoot = null;
  }
  const host = document.getElementById('crow-ext-host');
  if (host) host.remove();
}

async function mountIfEnabled() {
  if (!extensionContextLikelyOk()) return;
  const raw = await chrome.storage.local.get([CROW_EXTENSION_ENABLED_KEY]);
  if (raw[CROW_EXTENSION_ENABLED_KEY] !== false) mount();
}

// Gate initial mount on the pause toggle
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void mountIfEnabled());
} else {
  void mountIfEnabled();
}

// Dynamic toggle: listen for storage changes to mount/unmount without page refresh
if (extensionContextLikelyOk()) {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const change = changes[CROW_EXTENSION_ENABLED_KEY];
    if (!change) return;
    const enabled = change.newValue !== false;
    if (enabled) {
      mountIfEnabled();
    } else {
      unmount();
    }
  });
}

// 心跳检测：定期确认 extension context 仍有效，主动清除「僵尸悬浮窗」。
//
// 两层检测：
//   1. extensionContextLikelyOk()（同步）：检查 chrome.runtime.id，
//      扩展「重载/更新」时此值变为 undefined → 立即卸载。
//   2. chrome.storage.local.get 空查询（异步）：发起真实 API 调用，
//      扩展「被移除/卸载」后 chrome.runtime.id 仍可能保留旧值，
//      但异步 API 会在回调里设置 lastError → 触发卸载。
//      两次检测共用同一个 setInterval，避免双计时器。
if (extensionContextLikelyOk()) {
  const heartbeatId = setInterval(() => {
    // 快速同步检测（重载/更新场景）
    if (!extensionContextLikelyOk()) {
      clearInterval(heartbeatId);
      unmount();
      return;
    }
    // 异步 API 检测（移除/卸载场景）
    try {
      chrome.storage.local.get([], () => {
        if (chrome.runtime.lastError) {
          clearInterval(heartbeatId);
          unmount();
        }
      });
    } catch {
      clearInterval(heartbeatId);
      unmount();
    }
  }, 1000);
}
