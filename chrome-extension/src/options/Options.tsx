import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CROW_AUTH_LOCAL_KEYS,
  ensureFreshAuth,
  loadCrowAuth,
} from '../lib/crow-session';

const DEFAULT_SITE_ORIGIN = 'https://dev.crowknows.tech';

export default function Options() {
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshHint, setRefreshHint] = useState('');
  /** 忽略本轮 local 授权键变更（手动保存 / 设置内刷新），避免误显示「网站已同步」 */
  const skipAuthStorageEventsRef = useRef(false);

  const applyAuthStateFromStorage = useCallback(
    async (opts: { showWebSyncHint: boolean }) => {
      const auth = await loadCrowAuth();
      const sync = await chrome.storage.sync.get(['adminSecret']);
      const url = auth?.apiBaseUrl || '';
      const token = auth?.accessToken || '';
      setApiBaseUrl(url);
      setAccessToken(token);
      setManualUrl(url);
      setManualToken(token);
      if (!token && sync.adminSecret) {
        setError('检测到旧版配置，请在网站登录后点「连接插件」重新授权。');
      } else {
        setError('');
      }
      if (opts.showWebSyncHint && token) {
        setRefreshHint('已通过网站同步连接状态。');
        setTimeout(() => setRefreshHint(''), 2800);
      }
    },
    []
  );

  useEffect(() => {
    const id = window.setTimeout(() => {
      void applyAuthStateFromStorage({ showWebSyncHint: false });
    }, 0);
    return () => window.clearTimeout(id);
  }, [applyAuthStateFromStorage]);

  useEffect(() => {
    function onStorageChanged(
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: chrome.storage.AreaName
    ) {
      if (areaName !== 'local') return;
      const hit = CROW_AUTH_LOCAL_KEYS.some((k) => changes[k] !== undefined);
      if (!hit || skipAuthStorageEventsRef.current) return;
      void applyAuthStateFromStorage({ showWebSyncHint: true });
    }
    chrome.storage.onChanged.addListener(onStorageChanged);
    return () => chrome.storage.onChanged.removeListener(onStorageChanged);
  }, [applyAuthStateFromStorage]);

  const isConnected = !!(apiBaseUrl && accessToken);

  async function refreshConnectionStatus() {
    skipAuthStorageEventsRef.current = true;
    setIsRefreshing(true);
    setRefreshHint('');
    try {
      const before = await loadCrowAuth();
      const after = await ensureFreshAuth(before, { force: true });
      const sync = await chrome.storage.sync.get(['adminSecret']);
      const fromDisk = after ?? (await loadCrowAuth());

      if (fromDisk?.accessToken) {
        setApiBaseUrl(fromDisk.apiBaseUrl);
        setAccessToken(fromDisk.accessToken);
        setManualUrl(fromDisk.apiBaseUrl);
        setManualToken(fromDisk.accessToken);
      } else {
        setApiBaseUrl('');
        setAccessToken('');
      }

      if (after) {
        setRefreshHint('连接状态已更新（如已续期会话）。');
        setTimeout(() => setRefreshHint(''), 2800);
      } else if (before) {
        setRefreshHint('未能续期会话，请在网站打开并点「连接插件」重新授权。');
      } else {
        setRefreshHint('当前无已保存的登录状态。');
      }

      if (!fromDisk?.accessToken && sync.adminSecret) {
        setError('检测到旧版配置，请在网站登录后点「连接插件」重新授权。');
      } else if (!fromDisk?.accessToken) {
        setError('');
      }
    } finally {
      setIsRefreshing(false);
      queueMicrotask(() => {
        skipAuthStorageEventsRef.current = false;
      });
    }
  }

  async function handleManualSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const url = manualUrl.trim().replace(/\/$/, '');
    if (!url) { setError('请填写 API 地址'); return; }
    if (!manualToken.trim()) { setError('请填写访问令牌'); return; }
    skipAuthStorageEventsRef.current = true;
    try {
      await chrome.storage.local.set({
        apiBaseUrl: url,
        accessToken: manualToken.trim(),
        refreshToken: '',
        supabaseUrl: '',
        supabaseAnonKey: '',
        expiresAt: null,
      });
      await chrome.storage.sync.remove(['accessToken', 'apiBaseUrl', 'adminSecret']);
      setApiBaseUrl(url);
      setAccessToken(manualToken.trim());
      setError('');
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      queueMicrotask(() => {
        skipAuthStorageEventsRef.current = false;
      });
    }
  }

  function openSite() {
    chrome.tabs.create({ url: apiBaseUrl || DEFAULT_SITE_ORIGIN });
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>
          这是啥<span style={{ color: '#f97316' }}>？</span> — 设置
        </h1>

        {/* 连接状态主区域 */}
        <div style={styles.statusBox}>
          <div style={styles.statusRow}>
            <span style={isConnected ? styles.dotGreen : styles.dotRed} />
            <span style={styles.statusTextWrap}>
              {isConnected ? '插件已连接到你的账号' : '插件尚未连接'}
            </span>
            <button
              type="button"
              onClick={() => void refreshConnectionStatus()}
              disabled={isRefreshing}
              style={isRefreshing ? styles.btnRefreshDisabled : styles.btnRefresh}
            >
              {isRefreshing ? '刷新中…' : '刷新状态'}
            </button>
          </div>
          {isConnected && (
            <p style={styles.statusHint}>{apiBaseUrl}</p>
          )}
          {refreshHint ? (
            <p
              style={{
                ...styles.refreshHint,
                color: refreshHint.startsWith('连接状态已更新') ||
                  refreshHint.startsWith('已通过网站')
                  ? '#22c55e'
                  : refreshHint.startsWith('未能续期')
                    ? '#fbbf24'
                    : '#71717a',
              }}
            >
              {refreshHint}
            </p>
          ) : null}
        </div>

        {/* 主操作：去网站连接 */}
        <div style={styles.primaryAction}>
          <p style={styles.desc}>
            {isConnected
              ? '在网站点「连接插件」后，插件会自动续期登录凭证；若长期未用或已在网站退出，请重新连接。'
              : '请先在网站登录，然后点「连接插件」按钮，插件会自动获取你的登录状态。'}
          </p>
          <button onClick={openSite} style={styles.btnPrimary}>
            {isConnected ? '打开网站（重新连接）' : '去网站登录并连接'}
          </button>
        </div>

        {/* 分隔线 */}
        <hr style={styles.divider} />

        {/* 备用：手动填写 */}
        <button
          onClick={() => setShowManual((v) => !v)}
          style={styles.toggleManual}
        >
          {showManual ? '▲ 收起手动配置' : '▼ 手动填写（自部署 / 开发者）'}
        </button>

        {showManual && (
          <form onSubmit={handleManualSave} style={{ marginTop: 16 }}>
            <div style={styles.field}>
              <label style={styles.label}>API 地址</label>
              <input
                style={styles.input}
                type="url"
                value={manualUrl}
                onChange={(e) => setManualUrl(e.target.value)}
                placeholder="https://dev.crowknows.tech"
                spellCheck={false}
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>访问令牌</label>
              <input
                style={styles.input}
                type="password"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder="eyJ…（Supabase access_token）"
                spellCheck={false}
                autoComplete="off"
              />
              <p style={styles.hint}>
                F12 → Application → Local Storage → 找 <code style={styles.code}>sb-…-auth-token</code> → 复制 <code style={styles.code}>access_token</code> 字段
              </p>
            </div>
            {error && <p style={styles.error}>{error}</p>}
            <button type="submit" style={saved ? styles.btnSaved : styles.btnSecondary}>
              {saved ? '✓ 已保存' : '保存'}
            </button>
          </form>
        )}

        {!showManual && error && <p style={{ ...styles.error, marginTop: 12 }}>{error}</p>}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh',
    background: '#09090b',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    padding: '48px 16px',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  },
  card: {
    background: '#18181b',
    border: '1px solid #27272a',
    borderRadius: 16,
    padding: '32px 28px',
    width: '100%',
    maxWidth: 480,
  },
  title: {
    fontSize: 22,
    fontWeight: 700,
    color: '#f4f4f5',
    marginBottom: 20,
  },
  statusBox: {
    background: '#09090b',
    border: '1px solid #27272a',
    borderRadius: 10,
    padding: '14px 16px',
    marginBottom: 20,
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusTextWrap: {
    flex: '1 1 120px',
    minWidth: 0,
    fontSize: 14,
    fontWeight: 600,
    color: '#f4f4f5',
  },
  btnRefresh: {
    background: '#27272a',
    color: '#d4d4d8',
    border: '1px solid #3f3f46',
    borderRadius: 8,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    flexShrink: 0,
    marginLeft: 'auto',
  },
  btnRefreshDisabled: {
    background: '#27272a',
    color: '#71717a',
    border: '1px solid #3f3f46',
    borderRadius: 8,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'default',
    flexShrink: 0,
    marginLeft: 'auto',
    opacity: 0.85,
  },
  refreshHint: {
    fontSize: 12,
    marginTop: 8,
    marginLeft: 16,
    lineHeight: 1.5,
    marginBottom: 0,
  },
  dotGreen: {
    width: 8, height: 8, borderRadius: '50%',
    background: '#22c55e',
    flexShrink: 0,
  },
  dotRed: {
    width: 8, height: 8, borderRadius: '50%',
    background: '#f87171',
    flexShrink: 0,
  },
  statusHint: {
    fontSize: 12,
    color: '#52525b',
    marginTop: 4,
    marginLeft: 16,
  },
  primaryAction: {
    marginBottom: 8,
  },
  desc: {
    fontSize: 13,
    color: '#71717a',
    lineHeight: 1.6,
    marginBottom: 14,
  },
  btnPrimary: {
    background: '#f97316',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 20px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%',
  },
  divider: {
    border: 'none',
    borderTop: '1px solid #27272a',
    margin: '20px 0',
  },
  toggleManual: {
    background: 'none',
    border: 'none',
    color: '#52525b',
    fontSize: 12,
    cursor: 'pointer',
    padding: 0,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#d4d4d8',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    background: '#09090b',
    border: '1px solid #3f3f46',
    borderRadius: 8,
    padding: '10px 12px',
    fontSize: 14,
    color: '#f4f4f5',
    outline: 'none',
    boxSizing: 'border-box',
  },
  hint: {
    fontSize: 12,
    color: '#52525b',
    marginTop: 5,
    lineHeight: 1.5,
  },
  code: {
    color: '#a1a1aa',
    fontSize: 11,
  },
  error: {
    fontSize: 13,
    color: '#f87171',
    lineHeight: 1.5,
  },
  btnSecondary: {
    background: '#27272a',
    color: '#d4d4d8',
    border: '1px solid #3f3f46',
    borderRadius: 8,
    padding: '10px 20px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    marginTop: 4,
  },
  btnSaved: {
    background: '#22c55e',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 20px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'default',
    marginTop: 4,
  },
};
