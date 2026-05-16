import { useEffect, useRef, useState } from 'react';
import type { CrowAuth } from '../lib/crow-session';
import { ensureFreshAuth, loadCrowAuth } from '../lib/crow-session';
import { useStreamExplain } from './useStreamExplain';

interface Props {
  text: string;
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

export default function ExplainCard({
  text,
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
  const cardRef = useRef<HTMLDivElement>(null);
  const { text: explanation, isLoading, error, isDone, explain } = useStreamExplain(
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
  const showSaveFooter = hasExplainReady || Boolean(saveError) || isSaving;

  useEffect(() => {
    explain(text);
  }, [text, explain]);

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

  async function handleSave() {
    setSaveError(null);
    setIsSaving(true);
    try {
      const preHint = await loadCrowAuth();
      const auth = await ensureFreshAuth(preHint, { force: true });
      if (!auth?.accessToken) {
        setSaveError('expired');
        return;
      }
      onSessionUpdate?.(auth);

      const baseUrl = (auth.apiBaseUrl || config.apiBaseUrl).replace(/\/+$/, '');

      const postNote = (token: string) =>
        fetch(`${baseUrl}/api/notes`, {
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

      let res = await postNote(auth.accessToken);
      if (res.status === 401 || res.status === 403) {
        const after = await ensureFreshAuth(await loadCrowAuth(), { force: true });
        if (!after?.accessToken) {
          setSaveError('expired');
          return;
        }
        onSessionUpdate?.(after);
        res = await postNote(after.accessToken);
      }

      if (res.ok) {
        const data = await res.json();
        setSavedId(data.data?.id ?? 'saved');
      } else if (res.status === 401 || res.status === 403) {
        setSaveError('expired');
      } else {
        setSaveError('generic');
      }
    } catch {
      setSaveError('generic');
    } finally {
      setIsSaving(false);
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
        {explanation && (
          <span>
            {explanation}
            {isLoading && <span className="crow-cursor" />}
          </span>
        )}
      </div>

      {showSaveFooter && (
        <div className="crow-card-footer">
          {!isAuthenticated ? (
            <button
              className="crow-save-btn"
              onClick={onConnectPlugin}
              type="button"
              title="点击打开插件设置，连接你的账号"
            >
              连接插件后可保存
            </button>
          ) : savedId ? (
            <button className="crow-save-btn saved" disabled>
              ✓ 已存入笔记本
            </button>
          ) : saveError === 'expired' ? (
            <span className="crow-error" style={{ fontSize: 12 }}>
              ⚠️ 登录或连接已过期，请
              <a
                href={config.apiBaseUrl}
                target="_blank"
                rel="noreferrer"
                style={{ color: '#fb923c', marginLeft: 2 }}
              >
                回网站登录并点「连接插件」
              </a>
            </span>
          ) : saveError === 'generic' ? (
            <span className="crow-error" style={{ fontSize: 12 }}>
              保存失败，请稍后重试
            </span>
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
