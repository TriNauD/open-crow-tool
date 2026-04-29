import { createRoot } from 'react-dom/client';
import { samePageOrigin } from '../../../lib/utils/same-page-origin';
import {
  extensionContextLikelyOk,
  isExtensionContextInvalidatedError,
} from '../lib/extension-context';
import { persistCrowAuth, type CrowAuth } from '../lib/crow-session';
import App from './App';
import { STYLES } from './styles';

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
    } catch (err) {
      if (!isExtensionContextInvalidatedError(err)) {
        console.warn('[Crow ext] connect bridge storage failed', err);
      }
    }
  })();
});

function mount() {
  if (document.getElementById('crow-ext-host')) return;
  // Crow 自身站点：不挂载浮动 UI（避免与原生界面冲突），但 connect 监听已在上方注册
  if (document.documentElement.dataset.crowNative === 'true') return;

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

  createRoot(container).render(<App />);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount);
} else {
  mount();
}
