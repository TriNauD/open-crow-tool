import { useCallback, useEffect, useRef, useState } from 'react';
import {
  extensionContextLikelyOk,
  ignoreIfContextInvalidated,
  isExtensionContextInvalidatedError,
} from '../lib/extension-context';
import type { CrowAuth } from '../lib/crow-session';
import { CROW_AUTH_LOCAL_KEYS, loadCrowAuth } from '../lib/crow-session';
import {
  CROW_AUTH_BROADCAST_EVENT,
  clearPendingCrowAuth,
  drainPendingCrowAuth,
} from './crow-auth-broadcast';
import { fabDebug } from './debug-fab-log';
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

/** 从某一 Window 读选区；rect 需相对顶层视口时再叠 iframe 偏移 */
function selectionFromWindow(w: Window, iframeOffset?: { left: number; top: number }): Selection | null {
  const sel = w.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
  const text = sel.toString().trim();
  if (text.length < 2) return null;
  const range = sel.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  const ox = iframeOffset?.left ?? 0;
  const oy = iframeOffset?.top ?? 0;
  return {
    text,
    x: ox + rect.left + rect.width / 2,
    y: oy + rect.top,
  };
}

function readDomSelection(): Selection | null {
  const top = selectionFromWindow(window);
  if (top) return top;
  const ae = document.activeElement;
  if (ae instanceof HTMLIFrameElement) {
    try {
      const w = ae.contentWindow;
      if (!w) return null;
      const fr = ae.getBoundingClientRect();
      return selectionFromWindow(w, { left: fr.left, top: fr.top });
    } catch {
      /* cross-origin iframe */
    }
  }
  return null;
}

/** 会话刚就绪时读 DOM：瞬时读空则保留 React 内已有选区（常见于先划词、后「连接插件」时 hasApi 才变 true）。 */
function pickSelectionAfterAuth(prev: Selection | null, phase: string): Selection | null {
  const dom = readDomSelection();
  const next = dom ?? prev;
  // #region agent log
  fabDebug({
    hypothesisId: 'H4',
    location: 'App.tsx:pickSelectionAfterAuth',
    message: phase,
    data: {
      hasSel: !!next,
      fromDom: !!dom,
      keptPrev: !dom && !!prev,
      prevLen: prev?.text?.length ?? 0,
    },
  });
  // #endregion
  return next;
}

export default function App() {
  const [config, setConfig] = useState<CrowAuth>(EMPTY_AUTH);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [explaining, setExplaining] = useState<Selection | null>(null);
  const configRef = useRef(config);
  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    fabDebug({
      hypothesisId: 'H3',
      location: 'App.tsx:mount',
      message: 'App component mounted',
      data: {
        isTop: window === window.top,
        href: window.location.href.slice(0, 96),
      },
    });
  }, []);

  useEffect(() => {
    fabDebug({
      hypothesisId: 'H1',
      location: 'App.tsx:stateSnapshot',
      message: 'config / selection / explaining',
      data: {
        hasApi: !!config.apiBaseUrl,
        hasSelection: !!selection,
        explaining: !!explaining,
      },
    });
  }, [config.apiBaseUrl, selection, explaining]);

  const reloadAuth = useCallback(() => {
    if (!extensionContextLikelyOk()) return;
    void loadCrowAuth()
      .then((a) => {
        if (a) {
          fabDebug({
            hypothesisId: 'H1',
            location: 'App.tsx:reloadAuth',
            message: 'loadCrowAuth has session',
            data: { hasApi: !!a.apiBaseUrl },
          });
          setConfig(a);
          setSelection((prev) => pickSelectionAfterAuth(prev, 'reloadAuth sync'));
          queueMicrotask(() => setSelection((prev) => pickSelectionAfterAuth(prev, 'reloadAuth microtask')));
          setTimeout(() => setSelection((prev) => pickSelectionAfterAuth(prev, 'reloadAuth 50ms')), 50);
        } else {
          setConfig(EMPTY_AUTH);
          setSelection(null);
        }
      })
      .catch((err) => {
        if (!isExtensionContextInvalidatedError(err)) console.warn('[Crow ext] loadCrowAuth failed', err);
      });
  }, []);

  useEffect(() => {
    if (!extensionContextLikelyOk()) return;

    reloadAuth();

    function onStorageChanged(changes: Record<string, chrome.storage.StorageChange>, area: chrome.storage.AreaName) {
      const hitCrow = CROW_AUTH_LOCAL_KEYS.some((k) => changes[k] !== undefined);
      // #region agent log
      fabDebug({
        hypothesisId: 'H7',
        location: 'App.tsx:onStorageChanged',
        message: 'storage listener',
        data: {
          area,
          hitCrow,
          keys: Object.keys(changes).slice(0, 12),
        },
      });
      // #endregion
      if (area === 'local' || area === 'sync') reloadAuth();
    }

    function onBecameVisible() {
      if (document.visibilityState !== 'visible') return;
      // #region agent log
      fabDebug({
        hypothesisId: 'H6',
        location: 'App.tsx:visibilitychange',
        message: 'visible -> reloadAuth',
        data: {},
      });
      // #endregion
      reloadAuth();
    }

    function onWindowFocus() {
      // #region agent log
      fabDebug({
        hypothesisId: 'H6',
        location: 'App.tsx:window-focus',
        message: 'focus -> reloadAuth',
        data: {},
      });
      // #endregion
      reloadAuth();
    }

    document.addEventListener('visibilitychange', onBecameVisible);
    window.addEventListener('focus', onWindowFocus);
    chrome.storage.onChanged.addListener(onStorageChanged);
    return () => {
      document.removeEventListener('visibilitychange', onBecameVisible);
      window.removeEventListener('focus', onWindowFocus);
      ignoreIfContextInvalidated(() => chrome.storage.onChanged.removeListener(onStorageChanged));
    };
  }, [reloadAuth]);

  useEffect(() => {
    let selT: ReturnType<typeof setTimeout> | undefined;
    let readR: ReturnType<typeof setTimeout> | undefined;
    let lastPointerUpAt = 0;

    /** 划词结束后再读 DOM：microtask 抢早读 + 短延迟再对齐（含同源 iframe） */
    function scheduleSelectionReadAfterPointer() {
      lastPointerUpAt = Date.now();
      if (readR != null) clearTimeout(readR);
      function flushPointerSelection(phase: string) {
        const s = readDomSelection();
        // #region agent log
        fabDebug({
          hypothesisId: 'H2',
          location: 'App.tsx:pointerRead',
          message: phase,
          data: {
            hasSel: !!s,
            textLen: s?.text?.length ?? 0,
            hasApi: !!configRef.current.apiBaseUrl,
          },
        });
        // #endregion
        setSelection(s);
      }
      queueMicrotask(() => flushPointerSelection('microtask'));
      readR = setTimeout(() => {
        readR = undefined;
        flushPointerSelection('delayed-50ms');
      }, 50);
    }

    /** 仅用 pointerup：避免与 mouseup 重复触发同一划词结束，造成双次 microtask/定时读。 */
    function onPointerUp() {
      scheduleSelectionReadAfterPointer();
    }

    /** 指针划词后短时间内忽略 selectionchange（站点常在随后清空/重建选区） */
    function onSelectionChange() {
      if (Date.now() - lastPointerUpAt < 280) return;
      if (selT != null) clearTimeout(selT);
      selT = setTimeout(() => {
        const s = readDomSelection();
        if (!s) return;
        // #region agent log
        fabDebug({
          hypothesisId: 'H5',
          location: 'App.tsx:selectionchange',
          message: 'debounced selectionchange',
          data: {
            hasSel: true,
            textLen: s.text.length,
            hasApi: !!configRef.current.apiBaseUrl,
          },
        });
        // #endregion
        setSelection(s);
      }, 90);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setExplaining(null);
        setSelection(null);
      }
    }

    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('selectionchange', onSelectionChange);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      if (selT != null) clearTimeout(selT);
      if (readR != null) clearTimeout(readR);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('selectionchange', onSelectionChange);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  useEffect(() => {
    function applyFromBroadcast(auth: CrowAuth | undefined) {
      const direct = !!(auth?.apiBaseUrl && auth?.accessToken);
      fabDebug({
        hypothesisId: 'H4',
        location: 'App.tsx:applyFromBroadcast',
        message: direct ? 'direct setConfig' : 'fallback reloadAuth',
        data: { direct },
      });
      if (direct) {
        setConfig(auth!);
        setSelection((prev) => pickSelectionAfterAuth(prev, 'broadcast sync'));
        queueMicrotask(() => setSelection((prev) => pickSelectionAfterAuth(prev, 'broadcast microtask')));
        setTimeout(() => setSelection((prev) => pickSelectionAfterAuth(prev, 'broadcast 50ms')), 50);
      } else reloadAuth();
    }

    function onBroadcast(e: Event) {
      clearPendingCrowAuth();
      applyFromBroadcast((e as CustomEvent<CrowAuth | undefined>).detail);
    }

    window.addEventListener(CROW_AUTH_BROADCAST_EVENT, onBroadcast);
    const stale = drainPendingCrowAuth();
    if (stale !== undefined) applyFromBroadcast(stale);

    return () => {
      window.removeEventListener(CROW_AUTH_BROADCAST_EVENT, onBroadcast);
    };
  }, [reloadAuth]);

  // Alt+W from background service worker
  useEffect(() => {
    function onMessage(msg: { type: string }) {
      if (msg.type !== 'CROW_EXPLAIN') return;
      const picked = readDomSelection();
      if (picked) {
        setSelection(null);
        setExplaining(picked);
        window.getSelection()?.removeAllRanges();
        const ae = document.activeElement;
        if (ae instanceof HTMLIFrameElement) {
          try {
            ae.contentWindow?.getSelection()?.removeAllRanges();
          } catch {
            /* cross-origin */
          }
        }
        return;
      }
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
  }, [reloadAuth]);

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
