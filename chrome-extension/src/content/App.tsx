import { useCallback, useEffect, useState } from 'react';
import {
  extensionContextLikelyOk,
  ignoreIfContextInvalidated,
  isExtensionContextInvalidatedError,
} from '../lib/extension-context';
import type { CrowAuth } from '../lib/crow-session';
import { loadCrowAuth } from '../lib/crow-session';
import {
  CROW_AUTH_BROADCAST_EVENT,
  clearPendingCrowAuth,
  drainPendingCrowAuth,
} from './crow-auth-broadcast';
import FloatingButton from './FloatingButton';
import ExplainCard from './ExplainCard';
import { extractSurroundingText } from './surrounding-text';

// 版本标记：真机排查「刷新扩展后仍走旧行为」时先看这行是否更新。
console.info('[crow] content script loaded — dom-anchor-follow 2026-09-03');

const EMPTY_AUTH: CrowAuth = {
  apiBaseUrl: '',
  accessToken: '',
  refreshToken: '',
  supabaseUrl: '',
  supabaseAnonKey: '',
  expiresAt: undefined,
};

/** 未连接时的公开 explain 端点 base URL（/api/explain 为公开接口，无需 token） */
const FALLBACK_API_BASE_URL =
  (typeof import.meta.env.VITE_PUBLIC_SITE_URL === 'string' && import.meta.env.VITE_PUBLIC_SITE_URL) ||
  'https://dev.crowknows.tech';

function openCrowOptionsPage(): void {
  if (!extensionContextLikelyOk()) return;
  ignoreIfContextInvalidated(() => {
    chrome.runtime.openOptionsPage();
  });
}

interface SelectionBase {
  text: string;
  x: number;
  y: number;
  /** 选区底边（视口坐标）；浮动按钮避让放下方时用 */
  bottom: number;
  /** 选区 Range 快照：浮标滚动/缩放时实时读它的屏幕坐标，让气泡和词锁在一起 */
  range: Range;
  /** 选区前后纯文本；取不到则为 undefined */
  surroundingText?: string;
}

interface Selection extends SelectionBase {
  /**
   * 选区身份：只有「确实换了一段选区」才递增。
   * 浮标用它做 key——重挂载即重新落位；而重复读取同一选区（鉴权就绪、
   * microtask / 50ms 补读）必须复用旧对象，否则 range 换新会触发锚点重挂靠，
   * 造成气泡闪一下再跳回去。
   */
  id: number;
}

/** 从某一 Window 读选区；rect 需相对顶层视口时再叠 iframe 偏移 */
function selectionFromWindow(
  w: Window,
  iframeOffset?: { left: number; top: number }
): SelectionBase | null {
  const sel = w.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return null;
  const text = sel.toString().trim();
  if (text.length < 2) return null;
  const range = sel.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  const ox = iframeOffset?.left ?? 0;
  const oy = iframeOffset?.top ?? 0;
  const surrounding = extractSurroundingText(range);
  return {
    text,
    x: ox + rect.left + rect.width / 2,
    y: oy + rect.top,
    bottom: oy + rect.bottom,
    range: range.cloneRange(),
    surroundingText: surrounding || undefined,
  };
}

function readDomSelection(): SelectionBase | null {
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

/** 同一段选区（文字相同、位置未变，亚像素差忽略） */
function sameSelection(a: Selection | null, b: SelectionBase | null): boolean {
  if (!a || !b) return false;
  return (
    a.text === b.text &&
    Math.round(a.x) === Math.round(b.x) &&
    Math.round(a.y) === Math.round(b.y) &&
    Math.round(a.bottom) === Math.round(b.bottom)
  );
}

export default function App() {
  const [config, setConfig] = useState<CrowAuth>(EMPTY_AUTH);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [explaining, setExplaining] = useState<SelectionBase | null>(null);

  /**
   * 提交一次选区读取：等价选区沿原对象返回（连带保留原 range 引用，浮标不重挂靠）；
   * 确实是新选区才递增 id，让浮标重新挂载落位。
   */
  const commitSelection = useCallback((draft: SelectionBase | null) => {
    setSelection((prev) => {
      if (!draft) return null;
      if (sameSelection(prev, draft)) return prev;
      return { ...draft, id: (prev?.id ?? 0) + 1 };
    });
  }, []);

  /** 会话就绪时的补读：读空保留 React 内已有选区（先划词、后「连接插件」的常见路径） */
  const rereadSelection = useCallback(() => {
    const draft = readDomSelection();
    if (draft) commitSelection(draft);
  }, [commitSelection]);

  const reloadAuth = useCallback(() => {
    if (!extensionContextLikelyOk()) return;
    void loadCrowAuth()
      .then((a) => {
        if (a) {
          setConfig(a);
          rereadSelection();
          queueMicrotask(() => rereadSelection());
          setTimeout(() => rereadSelection(), 50);
        } else {
          setConfig(EMPTY_AUTH);
        }
      })
      .catch((err) => {
        if (!isExtensionContextInvalidatedError(err)) console.warn('[Crow ext] loadCrowAuth failed', err);
      });
  }, [rereadSelection]);

  useEffect(() => {
    if (!extensionContextLikelyOk()) return;

    reloadAuth();

    function onStorageChanged(changes: Record<string, chrome.storage.StorageChange>, area: chrome.storage.AreaName) {
      if (area === 'local' || area === 'sync') reloadAuth();
    }

    function onBecameVisible() {
      if (document.visibilityState !== 'visible') return;
      reloadAuth();
    }

    function onWindowFocus() {
      reloadAuth();
    }

    function onPageShow(e: PageTransitionEvent) {
      if (!e.persisted) return;
      if (!extensionContextLikelyOk()) return;
      reloadAuth();
    }

    document.addEventListener('visibilitychange', onBecameVisible);
    window.addEventListener('focus', onWindowFocus);
    window.addEventListener('pageshow', onPageShow);
    chrome.storage.onChanged.addListener(onStorageChanged);
    return () => {
      document.removeEventListener('visibilitychange', onBecameVisible);
      window.removeEventListener('focus', onWindowFocus);
      window.removeEventListener('pageshow', onPageShow);
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
      function flushPointerSelection() {
        commitSelection(readDomSelection());
      }
      queueMicrotask(() => flushPointerSelection());
      readR = setTimeout(() => {
        readR = undefined;
        flushPointerSelection();
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
        // 读空不清空：站点常在划词后短暂清空再重建选区
        if (!s) return;
        // 等价选区由 commitSelection 复用旧对象（含原 range），浮标不会重挂靠
        commitSelection(s);
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
  }, [commitSelection]);

  useEffect(() => {
    function applyFromBroadcast(auth: CrowAuth | undefined) {
      const direct = !!(auth?.apiBaseUrl && auth?.accessToken);
      if (direct) {
        setConfig(auth!);
        rereadSelection();
        queueMicrotask(() => rereadSelection());
        setTimeout(() => rereadSelection(), 50);
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
  }, [reloadAuth, rereadSelection]);

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
      const surrounding = extractSurroundingText(range);
      setSelection(null);
      setExplaining({
        text,
        x: rect.left + rect.width / 2,
        y: rect.top,
        bottom: rect.bottom,
        range: range.cloneRange(),
        surroundingText: surrounding || undefined,
      });
      sel.removeAllRanges();
    }
    chrome.runtime.onMessage.addListener(onMessage);
    return () => {
      ignoreIfContextInvalidated(() => chrome.runtime.onMessage.removeListener(onMessage));
    };
  }, [reloadAuth]);

  /** 是否已连接账号（需要 apiBaseUrl 与 accessToken 都有效） */
  const isAuthenticated = !!(config.apiBaseUrl && config.accessToken);

  /**
   * 向 ExplainCard 传递的 config：已连接时用真实 config；未连接时用公开 fallback URL
   * 以便 /api/explain（公开接口）可以正常调用，只有存笔记本时才需要 auth。
   */
  const effectiveConfig: CrowAuth = isAuthenticated
    ? config
    : { ...EMPTY_AUTH, apiBaseUrl: FALLBACK_API_BASE_URL };

  function triggerExplain() {
    if (!selection) return;
    setExplaining(selection);
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }

  return (
    <>
      {selection && !explaining && (
        // key 绑选区身份：换一段划词 = 卸载重挂，浮标必然消失并在新词处重新落位，
        // 不会沿用它上一次的落位状态（上下侧、可见性、复查时刻表）
        <FloatingButton
          key={selection.id}
          x={selection.x}
          y={selection.y}
          bottom={selection.bottom}
          range={selection.range}
          onClick={triggerExplain}
        />
      )}
      {explaining && (
        <ExplainCard
          text={explaining.text}
          surroundingText={explaining.surroundingText}
          anchorX={explaining.x}
          anchorY={explaining.y}
          config={effectiveConfig}
          isAuthenticated={isAuthenticated}
          onConnectPlugin={openCrowOptionsPage}
          onSessionUpdate={(next) => setConfig(next)}
          onClose={() => setExplaining(null)}
        />
      )}
    </>
  );
}
