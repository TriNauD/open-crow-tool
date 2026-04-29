import { useEffect, useState } from 'react';
import {
  extensionContextLikelyOk,
  ignoreIfContextInvalidated,
  isExtensionContextInvalidatedError,
} from '../lib/extension-context';
import type { CrowAuth } from '../lib/crow-session';
import { loadCrowAuth } from '../lib/crow-session';
import FloatingButton from './FloatingButton';
import ExplainCard from './ExplainCard';

const EMPTY_AUTH: CrowAuth = {
  apiBaseUrl: '',
  accessToken: '',
  refreshToken: '',
  supabaseUrl: '',
  supabaseAnonKey: '',
  expiresAt: undefined,
};

interface Selection {
  text: string;
  x: number;
  y: number;
}

export default function App() {
  const [config, setConfig] = useState<CrowAuth>(EMPTY_AUTH);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [explaining, setExplaining] = useState<Selection | null>(null);

  useEffect(() => {
    if (!extensionContextLikelyOk()) return;

    function reload() {
      void loadCrowAuth()
        .then((a) => {
          if (a) setConfig(a);
          else setConfig(EMPTY_AUTH);
        })
        .catch((err) => {
          if (!isExtensionContextInvalidatedError(err)) console.warn('[Crow ext] loadCrowAuth failed', err);
        });
    }

    reload();

    function onStorageChanged(
      _changes: Record<string, chrome.storage.StorageChange>,
      area: chrome.storage.AreaName
    ) {
      if (area === 'local' || area === 'sync') reload();
    }
    chrome.storage.onChanged.addListener(onStorageChanged);
    return () => {
      ignoreIfContextInvalidated(() => chrome.storage.onChanged.removeListener(onStorageChanged));
    };
  }, []);

  useEffect(() => {
    function onMouseUp() {
      setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !sel.rangeCount) {
          setSelection(null);
          return;
        }
        const text = sel.toString().trim();
        if (text.length < 2) {
          setSelection(null);
          return;
        }
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        setSelection({
          text,
          x: rect.left + rect.width / 2,
          y: rect.top,
        });
      }, 10);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setExplaining(null);
        setSelection(null);
      }
    }

    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  // Alt+W from background service worker
  useEffect(() => {
    function onMessage(msg: { type: string }) {
      if (msg.type !== 'CROW_EXPLAIN') return;
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) return;
      const text = sel.toString().trim();
      if (!text) return;
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelection(null);
      setExplaining({ text, x: rect.left + rect.width / 2, y: rect.top });
      sel.removeAllRanges();
    }
    chrome.runtime.onMessage.addListener(onMessage);
    return () => {
      ignoreIfContextInvalidated(() => chrome.runtime.onMessage.removeListener(onMessage));
    };
  }, []);

  function triggerExplain() {
    if (!selection) return;
    setExplaining(selection);
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }

  if (!config.apiBaseUrl) return null;

  return (
    <>
      {selection && !explaining && (
        <FloatingButton x={selection.x} y={selection.y} onClick={triggerExplain} />
      )}
      {explaining && (
        <ExplainCard
          text={explaining.text}
          anchorX={explaining.x}
          anchorY={explaining.y}
          config={config}
          onSessionUpdate={(next) => setConfig(next)}
          onClose={() => setExplaining(null)}
        />
      )}
    </>
  );
}
