import { useEffect, useRef, useState } from 'react';
import type { CrowAuth } from '../lib/crow-session';
import { ensureFreshAuth, loadCrowAuth } from '../lib/crow-session';
import { useStreamExplain } from './useStreamExplain';
import { normalizeNoteInput } from './normalize-note-input';
import CrowLoginForm from '../components/CrowLoginForm';

interface Props {
  text: string;
  /** 选区前后文（可选；截取失败时不传） */
  surroundingText?: string;
  anchorX: number;
  anchorY: number;
  config: CrowAuth;
  /** 是否已连接账号；未连接时解释仍可用，但保存功能替换为「连接插件」引导 */
  isAuthenticated?: boolean;
  /** 未连接时点击「连接插件」的回调 */
  onConnectPlugin?: () => void;
  onSessionUpdate?: (next: CrowAuth) => void;
  onClose: () => void;
}

type DuplicateHit = {
  id: string;
  inputText: string;
  explanation: string;
};

export default function ExplainCard({
  text,
  surroundingText,
  anchorX,
  anchorY,
  config,
  isAuthenticated = true,
  onConnectPlugin,
  onSessionUpdate,
  onClose,
}: Props) {
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<'generic' | 'expired' | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [duplicate, setDuplicate] = useState<DuplicateHit | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const { text: explanation, isLoading, error, isDone, explain, quotaOut } = useStreamExplain(
    config.apiBaseUrl
  );

  const cardW = 360;
  const cardH = 320;
  const margin = 12;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let left = anchorX - cardW / 2;
  left = Math.max(margin, Math.min(left, vw - cardW - margin));

  let top = anchorY - cardH - 10;
  if (top < margin) top = anchorY + 24;
  top = Math.max(margin, Math.min(top, vh - cardH - margin));

  const notebookUrl = `${config.apiBaseUrl.replace(/\/+$/, '')}/notebook`;

  /** 流式完成可保存，或保存中/已有错误时也要看到底部栏（避免 saveError 被 `&& explanation` 吃掉） */
  const hasExplainReady = Boolean(explanation?.length) && isDone && !error;
  const showSaveFooter =
    hasExplainReady || Boolean(saveError) || isSaving || Boolean(duplicate);

  useEffect(() => {
    explain(text, surroundingText ? { surroundingText } : undefined);
  }, [text, surroundingText, explain]);

  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      const path = e.composedPath();
      if (cardRef.current && !path.includes(cardRef.current)) {
        onClose();
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', onMouseDown);
    }, 150);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [onClose]);

  async function resolveAuth(): Promise<{ token: string; baseUrl: string } | null> {
    const preHint = await loadCrowAuth();
    const auth = await ensureFreshAuth(preHint, { force: true });
    if (!auth?.accessToken) {
      setSaveError('expired');
      return null;
    }
    onSessionUpdate?.(auth);
    const baseUrl = (auth.apiBaseUrl || config.apiBaseUrl).replace(/\/+$/, '');
    return { token: auth.accessToken, baseUrl };
  }

  async function findDuplicate(
    baseUrl: string,
    token: string
  ): Promise<DuplicateHit | null> {
    const q = encodeURIComponent(text.trim());
    const res = await fetch(`${baseUrl}/api/notes?q=${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      data?: Array<{
        id: string;
        inputText: string;
        explanation: string;
        parentText?: string;
      }>;
    };
    const needle = normalizeNoteInput(text);
    const hit = (body.data ?? []).find(
      (n) => normalizeNoteInput(n.inputText) === needle && !n.parentText
    );
    return hit
      ? { id: hit.id, inputText: hit.inputText, explanation: hit.explanation }
      : null;
  }

  async function postNote(baseUrl: string, token: string): Promise<Response> {
    return fetch(`${baseUrl}/api/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        inputText: text,
        explanation,
        source: 'chrome_extension',
      }),
    });
  }

  async function deleteNote(baseUrl: string, token: string, id: string): Promise<boolean> {
    const res = await fetch(`${baseUrl}/api/notes/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  }

  async function saveWithToken(
    baseUrl: string,
    token: string,
    mode: 'create' | 'replace',
    oldId?: string
  ): Promise<boolean> {
    let workingToken = token;
    if (mode === 'replace' && oldId) {
      const deleted = await deleteNote(baseUrl, workingToken, oldId);
      if (!deleted) {
        const after = await ensureFreshAuth(await loadCrowAuth(), { force: true });
        if (!after?.accessToken) {
          setSaveError('expired');
          return false;
        }
        onSessionUpdate?.(after);
        workingToken = after.accessToken;
        const again = await deleteNote(baseUrl, workingToken, oldId);
        if (!again) {
          setSaveError('generic');
          return false;
        }
      }
    }

    let res = await postNote(baseUrl, workingToken);
    if (res.status === 401 || res.status === 403) {
      const after = await ensureFreshAuth(await loadCrowAuth(), { force: true });
      if (!after?.accessToken) {
        setSaveError('expired');
        return false;
      }
      onSessionUpdate?.(after);
      res = await postNote(baseUrl, after.accessToken);
    }

    if (res.ok) {
      const data = await res.json();
      setSavedId(data.data?.id ?? 'saved');
      setDuplicate(null);
      return true;
    }
    if (res.status === 401 || res.status === 403) {
      setSaveError('expired');
    } else {
      setSaveError('generic');
    }
    return false;
  }

  async function handleSave() {
    setSaveError(null);
    setIsSaving(true);
    try {
      const auth = await resolveAuth();
      if (!auth) return;

      const hit = await findDuplicate(auth.baseUrl, auth.token);
      if (hit) {
        setDuplicate(hit);
        return;
      }
      await saveWithToken(auth.baseUrl, auth.token, 'create');
    } catch {
      setSaveError('generic');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleKeepBoth() {
    setSaveError(null);
    setIsSaving(true);
    try {
      const auth = await resolveAuth();
      if (!auth) return;
      await saveWithToken(auth.baseUrl, auth.token, 'create');
    } catch {
      setSaveError('generic');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleReplace() {
    if (!duplicate) return;
    setSaveError(null);
    setIsSaving(true);
    try {
      const auth = await resolveAuth();
      if (!auth) return;
      await saveWithToken(auth.baseUrl, auth.token, 'replace', duplicate.id);
    } catch {
      setSaveError('generic');
    } finally {
      setIsSaving(false);
    }
  }

  /** 内嵌登录成功：更新会话并自动继续登录前被打断的保存动作（含重复确认的覆盖场景） */
  async function handleLoginSuccess(auth: CrowAuth) {
    setLoginOpen(false);
    setSaveError(null);
    onSessionUpdate?.(auth);
    if (duplicate) {
      await handleReplace();
    } else {
      await handleSave();
    }
  }

  return (
    <div ref={cardRef} className="crow-card" style={{ left, top }}>
      <div className="crow-card-header">
        <div style={{ minWidth: 0 }}>
          <div className="crow-card-label">这是啥？</div>
          <div className="crow-card-query">
            {text.length > 80 ? text.slice(0, 80) + '…' : text}
          </div>
        </div>
        <button className="crow-close" onClick={onClose} title="关闭 (Esc)">
          ×
        </button>
      </div>

      <div className="crow-card-body">
        {isLoading && !explanation && (
          <div className="crow-loading">
            <span className="crow-dot" />
            <span className="crow-dot" />
            <span className="crow-dot" />
            <span style={{ marginLeft: 8 }}>正在思考中...</span>
          </div>
        )}
        {error && <div className="crow-error">{error}</div>}
        {loginOpen && (
          <div style={{ marginTop: explanation ? 10 : 0 }}>
            <CrowLoginForm
              variant="card"
              onSuccess={(auth) => void handleLoginSuccess(auth)}
              onCancel={() => setLoginOpen(false)}
            />
            {onConnectPlugin && (
              <p style={{ fontSize: 11, color: '#52525b', margin: '8px 0 0' }}>
                无法登录？
                <button
                  type="button"
                  onClick={onConnectPlugin}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#fb923c',
                    cursor: 'pointer',
                    padding: 0,
                    textDecoration: 'underline',
                    fontSize: 11,
                  }}
                >
                  打开扩展设置
                </button>
              </p>
            )}
          </div>
        )}
        {explanation && !duplicate && (
          <span>
            {explanation}
            {isLoading && <span className="crow-cursor" />}
          </span>
        )}
        {duplicate && (
          <div style={{ fontSize: 12, lineHeight: 1.5 }}>
            <p style={{ color: '#fb923c', margin: '0 0 8px' }}>已有同名笔记，请选择：</p>
            <p style={{ color: '#a1a1aa', margin: '0 0 4px' }}>旧答案（截断）：</p>
            <p style={{ color: '#d4d4d8', margin: '0 0 8px' }}>
              {duplicate.explanation.length > 160
                ? duplicate.explanation.slice(0, 160) + '…'
                : duplicate.explanation}
            </p>
            <p style={{ color: '#a1a1aa', margin: '0 0 4px' }}>新答案（截断）：</p>
            <p style={{ color: '#fafafa', margin: 0 }}>
              {(explanation ?? '').length > 160
                ? (explanation ?? '').slice(0, 160) + '…'
                : explanation}
            </p>
          </div>
        )}
      </div>

      {quotaOut && isDone && (
        <div className="crow-hint" style={{ fontSize: 11 }}>
          今日免费额度已用完，本次使用免费模型
        </div>
      )}

      {showSaveFooter && (
        <div className="crow-card-footer">
          {!isAuthenticated ? (
            loginOpen ? (
              <span className="crow-hint" style={{ fontSize: 12 }}>
                登录后即可存入笔记本
              </span>
            ) : (
              <button
                className="crow-save-btn"
                onClick={() => setLoginOpen(true)}
                type="button"
                title="在本卡片内登录，登录后自动继续保存"
              >
                登录后可保存
              </button>
            )
          ) : savedId ? (
            <button className="crow-save-btn saved" disabled>
              ✓ 已存入笔记本
            </button>
          ) : saveError === 'expired' ? (
            <span className="crow-error" style={{ fontSize: 12 }}>
              ⚠️ 登录或连接已过期，
              <button
                type="button"
                onClick={() => setLoginOpen(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fb923c',
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'underline',
                  fontSize: 12,
                }}
              >
                重新登录
              </button>
              后自动继续保存，或
              <a
                href={config.apiBaseUrl}
                target="_blank"
                rel="noreferrer"
                style={{ color: '#fb923c', marginLeft: 2 }}
              >
                回网站点「连接插件」
              </a>
            </span>
          ) : saveError === 'generic' ? (
            <span className="crow-error" style={{ fontSize: 12 }}>
              保存失败，请稍后重试
            </span>
          ) : duplicate ? (
            <>
              <button
                className="crow-save-btn"
                onClick={handleKeepBoth}
                disabled={isSaving}
                type="button"
              >
                {isSaving ? '保存中…' : '都保留'}
              </button>
              <span className="crow-sep">·</span>
              <button
                className="crow-save-btn"
                onClick={handleReplace}
                disabled={isSaving}
                type="button"
                style={{ color: '#fb923c' }}
              >
                覆盖旧的
              </button>
            </>
          ) : (
            <button
              className="crow-save-btn"
              onClick={handleSave}
              disabled={isSaving}
              type="button"
            >
              {isSaving ? '保存中…' : '存入笔记本'}
            </button>
          )}
          {isAuthenticated && (
            <>
              <span className="crow-sep">·</span>
              <a className="crow-save-btn" href={notebookUrl} target="_blank" rel="noreferrer">
                打开笔记本
              </a>
            </>
          )}
          <span className="crow-sep">·</span>
          <span className="crow-hint">Esc 关闭</span>
        </div>
      )}
    </div>
  );
}
