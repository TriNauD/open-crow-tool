import { useState } from 'react';
import type { CrowAuth } from '../lib/crow-session';
import { loginAndPersist } from '../lib/crow-inline-login';

interface Props {
  /** 登录成功（已 persist 会话）；调用方负责关闭表单与继续被打断的动作 */
  onSuccess: (auth: CrowAuth) => void;
  onCancel?: () => void;
  variant?: 'card' | 'popup';
}

/**
 * 内嵌邮箱密码登录表单（划词卡片 / Popup 共用）。
 * 与 Options 主路径同一协议：GoTrue password grant → persistCrowAuth。
 */
export default function CrowLoginForm({ onSuccess, onCancel, variant = 'card' }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const small = variant === 'popup';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const result = await loginAndPersist({ email, password });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setPassword('');
      onSuccess(result.auth);
    } finally {
      setLoading(false);
    }
  }

  const styles: Record<string, React.CSSProperties> = {
    form: { display: 'flex', flexDirection: 'column', gap: 8 },
    input: {
      width: '100%',
      background: '#09090b',
      border: '1px solid #3f3f46',
      borderRadius: 6,
      padding: small ? '7px 9px' : '8px 10px',
      fontSize: small ? 12 : 13,
      color: '#f4f4f5',
      outline: 'none',
      boxSizing: 'border-box',
    },
    button: {
      background: loading ? '#9a3412' : '#f97316',
      color: loading ? '#fdba74' : '#fff',
      border: 'none',
      borderRadius: 6,
      padding: small ? '8px 14px' : '8px 16px',
      fontSize: small ? 12 : 13,
      fontWeight: 600,
      cursor: loading ? 'default' : 'pointer',
    },
    error: {
      fontSize: 12,
      color: '#f87171',
      lineHeight: 1.5,
      margin: 0,
    },
    cancel: {
      background: 'none',
      border: 'none',
      color: '#71717a',
      fontSize: 12,
      cursor: 'pointer',
      padding: 0,
      textDecoration: 'underline',
    },
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} style={styles.form}>
      <input
        type="email"
        autoComplete="username"
        placeholder="邮箱"
        aria-label="邮箱"
        autoFocus
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={styles.input}
        required
        disabled={loading}
      />
      <input
        type="password"
        autoComplete="current-password"
        placeholder="密码"
        aria-label="密码"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={styles.input}
        required
        disabled={loading}
      />
      {error && <p style={styles.error}>{error}</p>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button type="submit" style={styles.button} disabled={loading}>
          {loading ? '登录中…' : '登录'}
        </button>
        {onCancel && (
          <button type="button" style={styles.cancel} onClick={onCancel} disabled={loading}>
            取消
          </button>
        )}
      </div>
    </form>
  );
}
