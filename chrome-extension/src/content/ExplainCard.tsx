import { useEffect, useRef, useState } from 'react';
import { useStreamExplain } from './useStreamExplain';

interface Config {
  apiBaseUrl: string;
  accessToken: string;
}

interface Props {
  text: string;
  anchorX: number;
  anchorY: number;
  config: Config;
  onClose: () => void;
}

export default function ExplainCard({ text, anchorX, anchorY, config, onClose }: Props) {
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<'generic' | 'expired' | null>(null);
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
    if (!config.accessToken) {
      setSaveError('expired');
      return;
    }
    try {
      const res = await fetch(`${config.apiBaseUrl}/api/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.accessToken}`,
        },
        body: JSON.stringify({
          inputText: text,
          explanation,
          source: 'chrome_extension',
        }),
      });
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

      {(isDone || saveError) && explanation && (
        <div className="crow-card-footer">
          {savedId ? (
            <button className="crow-save-btn saved" disabled>
              ✓ 已存入笔记本
            </button>
          ) : saveError === 'expired' ? (
            <span className="crow-error" style={{ fontSize: 12 }}>
              ⚠️ 登录已过期，请
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
          ) : (
            <button className="crow-save-btn" onClick={handleSave}>
              存入笔记本
            </button>
          )}
          <span className="crow-sep">·</span>
          <a className="crow-save-btn" href={notebookUrl} target="_blank" rel="noreferrer">
            打开笔记本
          </a>
          <span className="crow-sep">·</span>
          <span className="crow-hint">Esc 关闭</span>
        </div>
      )}
    </div>
  );
}
