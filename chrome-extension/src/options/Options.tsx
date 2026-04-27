import { useEffect, useState } from 'react';

export default function Options() {
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [manualToken, setManualToken] = useState('');
  const [manualUrl, setManualUrl] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    chrome.storage.sync.get(['apiBaseUrl', 'accessToken', 'adminSecret']).then((result) => {
      const url = (result.apiBaseUrl as string) || '';
      const token = (result.accessToken as string) || '';
      setApiBaseUrl(url);
      setAccessToken(token);
      setManualUrl(url);
      setManualToken(token);
      // 旧版只存了 adminSecret，提示需要在网站重新连接
      if (!token && result.adminSecret) {
        setError('检测到旧版配置，请在网站登录后点「连接插件」重新授权。');
      }
    });
  }, []);

  const isConnected = !!(apiBaseUrl && accessToken);

  async function handleManualSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const url = manualUrl.trim().replace(/\/$/, '');
    if (!url) { setError('请填写 API 地址'); return; }
    if (!manualToken.trim()) { setError('请填写访问令牌'); return; }
    await chrome.storage.sync.set({ apiBaseUrl: url, accessToken: manualToken.trim() });
    await chrome.storage.sync.remove('adminSecret');
    setApiBaseUrl(url);
    setAccessToken(manualToken.trim());
    setError('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function openSite() {
    chrome.tabs.create({ url: apiBaseUrl || 'https://open-crow-tool.vercel.app' });
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
            <span style={styles.statusText}>
              {isConnected ? '插件已连接到你的账号' : '插件尚未连接'}
            </span>
          </div>
          {isConnected && (
            <p style={styles.statusHint}>{apiBaseUrl}</p>
          )}
        </div>

        {/* 主操作：去网站连接 */}
        <div style={styles.primaryAction}>
          <p style={styles.desc}>
            {isConnected
              ? '登录凭证有效期约 1 小时。失效后在网站重新点「连接插件」即可。'
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
                placeholder="https://open-crow-tool.vercel.app"
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
  statusText: {
    fontSize: 14,
    fontWeight: 600,
    color: '#f4f4f5',
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
