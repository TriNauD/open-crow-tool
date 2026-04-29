import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { CROW_AUTH_LOCAL_KEYS, isCrowConfigured } from '../lib/crow-session';

function Popup() {
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    function reload() {
      void isCrowConfigured().then(setConfigured);
    }
    reload();
    function onStorageChanged(
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: chrome.storage.AreaName
    ) {
      if (areaName !== 'local') return;
      const hit = CROW_AUTH_LOCAL_KEYS.some((k) => changes[k] !== undefined);
      if (!hit) return;
      reload();
    }
    chrome.storage.onChanged.addListener(onStorageChanged);
    return () => chrome.storage.onChanged.removeListener(onStorageChanged);
  }, []);

  function openOptions() {
    chrome.runtime.openOptionsPage();
  }

  const s: React.CSSProperties = {
    width: 240,
    padding: '16px',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    background: '#18181b',
    color: '#f4f4f5',
    fontSize: 13,
    lineHeight: 1.5,
  };

  return (
    <div style={s}>
      <p style={{ fontWeight: 700, marginBottom: 8, fontSize: 15 }}>
        这是啥<span style={{ color: '#f97316' }}>？</span>
      </p>
      {configured === false && (
        <p style={{ color: '#fb923c', marginBottom: 10, fontSize: 12 }}>
          ⚠️ 未配置，请先填写设置
        </p>
      )}
      {configured === true && (
        <p style={{ color: '#4ade80', marginBottom: 10, fontSize: 12 }}>
          ✓ 已配置，在任意页面选词即可使用
        </p>
      )}
      <p style={{ color: '#71717a', fontSize: 12, marginBottom: 12 }}>
        选中文字后点击橙色按钮，或按{' '}
        <strong style={{ color: '#d4d4d8' }}>
          {navigator.platform.toLowerCase().includes('mac') ? 'Ctrl+Shift+W' : 'Alt+W'}
        </strong>
      </p>
      <button
        onClick={openOptions}
        style={{
          background: '#27272a',
          border: '1px solid #3f3f46',
          borderRadius: 6,
          color: '#d4d4d8',
          fontSize: 12,
          padding: '6px 12px',
          cursor: 'pointer',
          width: '100%',
        }}
      >
        打开设置
      </button>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Popup />);
