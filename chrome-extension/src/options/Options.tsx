import { useEffect, useState } from 'react';

export default function Options() {
  const [apiBaseUrl, setApiBaseUrl] = useState('');
  const [adminSecret, setAdminSecret] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    chrome.storage.sync.get(['apiBaseUrl', 'adminSecret']).then((result) => {
      setApiBaseUrl((result.apiBaseUrl as string) || '');
      setAdminSecret((result.adminSecret as string) || '');
    });
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const url = apiBaseUrl.trim().replace(/\/$/, '');
    if (!url) {
      setError('请填写 API 地址');
      return;
    }
    if (!adminSecret.trim()) {
      setError('请填写 Admin Secret');
      return;
    }

    await chrome.storage.sync.set({ apiBaseUrl: url, adminSecret: adminSecret.trim() });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>
          这是啥<span style={{ color: '#f97316' }}>？</span> — 设置
        </h1>
        <p style={styles.desc}>
          填写你的 Web 端地址和 Admin Secret，插件会通过这些信息调用 AI 解释和存储笔记。
        </p>

        <form onSubmit={handleSave}>
          <div style={styles.field}>
            <label style={styles.label}>API 地址</label>
            <input
              style={styles.input}
              type="url"
              value={apiBaseUrl}
              onChange={(e) => setApiBaseUrl(e.target.value)}
              placeholder="https://open-crow-tool.vercel.app"
              spellCheck={false}
            />
            <p style={styles.hint}>你的 Vercel 部署地址，末尾不加斜杠</p>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Admin Secret</label>
            <input
              style={styles.input}
              type="password"
              value={adminSecret}
              onChange={(e) => setAdminSecret(e.target.value)}
              placeholder="你在 .env.local 里设置的 ADMIN_SECRET"
              spellCheck={false}
            />
            <p style={styles.hint}>用于鉴权，存储在浏览器 sync storage 中</p>
          </div>

          {error && <p style={styles.error}>{error}</p>}

          <button type="submit" style={saved ? styles.btnSaved : styles.btn}>
            {saved ? '✓ 已保存' : '保存'}
          </button>
        </form>
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
    marginBottom: 8,
  },
  desc: {
    fontSize: 14,
    color: '#71717a',
    lineHeight: 1.6,
    marginBottom: 28,
  },
  field: {
    marginBottom: 20,
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
  },
  error: {
    fontSize: 13,
    color: '#f87171',
    marginBottom: 12,
  },
  btn: {
    background: '#f97316',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '10px 24px',
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
    padding: '10px 24px',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'default',
    marginTop: 4,
  },
};
