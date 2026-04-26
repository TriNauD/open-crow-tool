import { useEffect, useState } from 'react';
import FloatingButton from './FloatingButton';
import ExplainCard from './ExplainCard';

interface Config {
  apiBaseUrl: string;
  adminSecret: string;
}

interface Selection {
  text: string;
  x: number;
  y: number;
}

export default function App() {
  const [config, setConfig] = useState<Config>({ apiBaseUrl: '', adminSecret: '' });
  const [selection, setSelection] = useState<Selection | null>(null);
  const [explaining, setExplaining] = useState<Selection | null>(null);

  useEffect(() => {
    chrome.storage.sync.get(['apiBaseUrl', 'adminSecret']).then((result) => {
      setConfig({
        apiBaseUrl: (result.apiBaseUrl as string) || '',
        adminSecret: (result.adminSecret as string) || '',
      });
    });
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.apiBaseUrl || changes.adminSecret) {
        setConfig((prev) => ({
          apiBaseUrl: (changes.apiBaseUrl?.newValue as string) ?? prev.apiBaseUrl,
          adminSecret: (changes.adminSecret?.newValue as string) ?? prev.adminSecret,
        }));
      }
    });
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
    return () => chrome.runtime.onMessage.removeListener(onMessage);
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
          onClose={() => setExplaining(null)}
        />
      )}
    </>
  );
}
