import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import {
  ANCHOR_OK,
  candidateRect,
  clampButtonX,
  decidePlacement,
  isRectCoveredByHostUI,
  type Placement,
} from './floating-placement';

interface Props {
  x: number;
  /** 选区顶边（视口坐标） */
  y: number;
  /** 选区底边（视口坐标）；placement=below 时按钮放它下面 */
  bottom: number;
  /** 划词 Range：锚点定位模式下据此确定宿主元素与偏移 */
  range?: Range;
  onClick: () => void;
}

/** 宿主气泡（如 ChatGPT）常在划词后 ~200-300ms 才弹出：静默期内先藏着等它现身 */
const SETTLE_MS = 300;
const POLL_MS = 50;
const ANCHOR_HOST = '--crow-sel-host';

const BASE_STYLE: CSSProperties = {
  position: 'fixed',
  zIndex: 2147483647,
  background: '#f97316',
  color: '#fff',
  border: 'none',
  borderRadius: 20,
  padding: '5px 14px',
  fontSize: 13,
  fontWeight: 600,
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  cursor: 'pointer',
  whiteSpace: 'nowrap',
  boxShadow: '0 2px 12px rgba(0,0,0,0.5)',
  pointerEvents: 'auto',
};

export default function FloatingButton(props: Props) {
  // ChatGPT 划词气泡同款：CSS Anchor Positioning——宿主元素随内容被原生滚动，
  // 浏览器同帧重定位按钮，无 JS 参与、零抖动。不支持时回退 fixed + JS 跟随。
  if (ANCHOR_OK && props.range) {
    return <AnchoredButton {...props} />;
  }
  return <FixedButton {...props} />;
}

/** 从选区起点向上找最近块级宿主（display 非 inline），供 anchor-name 挂靠 */
function findBlockHost(range: Range): HTMLElement | null {
  let el: HTMLElement | null =
    range.startContainer instanceof HTMLElement
      ? range.startContainer
      : range.startContainer.parentElement;
  while (el && el !== document.documentElement) {
    if (!getComputedStyle(el).display.startsWith('inline')) return el;
    el = el.parentElement;
  }
  return null;
}

/** 选区相对宿主的静态偏移（px）：滚动时二者同体移动，偏移恒定 */
interface HostDeltas {
  /** 选区中心 x - 宿主 left */
  dx: number;
  /** 选区 top - 宿主 top */
  dya: number;
  /** 选区 bottom - 宿主 top */
  dyb: number;
}

/**
 * 锚点定位版：渲染进亮 DOM（position-anchor 不能跨 shadow 边界引用）。
 *
 * 注意：Chromium 的显式 `anchor(--name …)` 引用解析一次后不随滚动更新，
 * 只有 `position-anchor` + 隐式 `anchor(side)` 会实时重算——因此只用单个隐式锚点，
 * 选区与宿主的偏移在挂载时量好写成静态 px 值。
 * 不向页面插入任何节点（插入选区会打断选区并被 React 重渲染清除），
 * 仅在宿主元素上设 anchor-name 内联样式。
 */
function AnchoredButton({ x, y, bottom, range, onClick }: Props) {
  const [placement, setPlacement] = useState<Placement>('above');
  const [revealed, setRevealed] = useState(false);
  const [orphaned, setOrphaned] = useState(false);
  const [anchorFailed, setAnchorFailed] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const hostRef = useRef<HTMLElement | null>(null);
  const deltasRef = useRef<HostDeltas | null>(null);
  const savedAnchorNameRef = useRef<string | null>(null);
  const placementRef = useRef(placement);

  // 挂靠宿主：把「宿主 anchor-name + 静态偏移」作为状态（setState 只能出现在 callback）

  // 布局样式直接派生：anchor() 定位会随滚动实时重算——不能用 effect 写 DOM 的
  // top/left（React 重渲染时 style prop 会重置抹掉，wikipedia 场景实测）；也不能用
  // effect setState（react-hooks/set-state-in-effect）。渲染期纯计算最稳。
  const [offset, setOffset] = useState<{ dx: number; dya: number; dyb: number } | null>(null);
  const layoutStyle: CSSProperties = offset
    ? {
        positionAnchor: ANCHOR_HOST,
        left: `calc(anchor(left) + ${offset.dx}px)`,
        top:
          placement === 'above'
            ? `calc(anchor(top) + ${offset.dya}px)`
            : `calc(anchor(top) + ${offset.dyb}px)`,
        translate: placement === 'above' ? '-50% calc(-100% - 6px)' : '-50% 6px',
      }
    : {};

  useEffect(() => {
    if (!range) return;
    const t = window.setTimeout(() => {
      const host = findBlockHost(range);
      const selRect = range.getBoundingClientRect();
      if (!host || selRect.width + selRect.height === 0) {
        setAnchorFailed(true);
        return;
      }
      const hostRect = host.getBoundingClientRect();
      hostRef.current = host;
      const d = {
        dx: (selRect.left + selRect.right) / 2 - hostRect.left,
        dya: selRect.top - hostRect.top,
        dyb: selRect.bottom - hostRect.top,
      };
      deltasRef.current = d;
      setOffset(d);
      savedAnchorNameRef.current = host.style.getPropertyValue('anchor-name') || null;
      host.style.setProperty('anchor-name', ANCHOR_HOST);
    }, 0);
    return () => {
      clearTimeout(t);
      if (hostRef.current) {
        if (savedAnchorNameRef.current === null) {
          hostRef.current.style.removeProperty('anchor-name');
        } else {
          hostRef.current.style.setProperty('anchor-name', savedAnchorNameRef.current);
        }
      }
      hostRef.current = null;
      deltasRef.current = null;
    };
  }, [range]);

  /** 宿主实时矩形 + 静态偏移 → 当前选区坐标（滚动后仍准确）；宿主失效返回 null */
  const currentCoords = useCallback((): { x: number; y: number; bottom: number } | null => {
    const host = hostRef.current;
    const d = deltasRef.current;
    if (!host || !d || !host.isConnected) return null;
    const hr = host.getBoundingClientRect();
    return { x: hr.left + d.dx, y: hr.top + d.dya, bottom: hr.top + d.dyb };
  }, []);

  // 静默期：等宿主气泡现身再首现，避免「先被挡再跳开」
  useEffect(() => {
    const start = Date.now();
    const timers: number[] = [];
    const tick = () => {
      const c = currentCoords();
      if (!c) {
        setOrphaned(true);
        setRevealed(true);
        return;
      }
      const next = decidePlacement(c.x, c.y, c.bottom);
      if (next !== placementRef.current) {
        placementRef.current = next;
        setPlacement(next);
        setRevealed(true);
        return;
      }
      if (Date.now() - start >= SETTLE_MS) {
        setRevealed(true);
        return;
      }
      timers.push(window.setTimeout(tick, POLL_MS));
    };
    tick();
    return () => timers.forEach((t) => clearTimeout(t));
  }, [currentCoords]);

  // 兜底复检：更晚出现的宿主气泡仍会被挪开；宿主样式被页面重渲染抹掉时补写
  useEffect(() => {
    const timers = [400, 1000].map((delay) =>
      window.setTimeout(() => {
        const host = hostRef.current;
        if (!host) return;
        if (!host.isConnected) {
          setOrphaned(true);
          return;
        }
        if (host.style.getPropertyValue('anchor-name') !== ANCHOR_HOST) {
          host.style.setProperty('anchor-name', ANCHOR_HOST);
        }
        const c = currentCoords();
        if (!c) return;
        if (!isRectCoveredByHostUI(candidateRect(placement, c.x, c.y, c.bottom))) return;
        const other: Placement = placement === 'above' ? 'below' : 'above';
        if (!isRectCoveredByHostUI(candidateRect(other, c.x, c.y, c.bottom))) {
          placementRef.current = other;
          setPlacement(other);
        }
      }, delay)
    );
    return () => timers.forEach((t) => clearTimeout(t));
  }, [placement, currentCoords]);

  if (anchorFailed) {
    return <FixedButton x={x} y={y} bottom={bottom} onClick={onClick} />;
  }

  return createPortal(
    <button
      ref={btnRef}
      // class 仅作测试/调试选择器句柄；亮 DOM 中样式全部内联（shadow 样式不适用）
      className="crow-btn"
      style={{ ...BASE_STYLE, ...layoutStyle, visibility: revealed && !orphaned ? 'visible' : 'hidden' }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      这是啥？
    </button>,
    document.body
  );
}

/** 回退版：fixed + JS 滚动跟随（App 在不支持锚点定位时启用跟随） */
function FixedButton({ x, y, bottom, onClick }: Props) {
  const [placement, setPlacementState] = useState<Placement>(() => decidePlacement(x, y, bottom));
  const [revealed, setRevealed] = useState(false);
  /** 定时器读 ref 而非依赖坐标 props：滚动跟随时坐标每帧更新，不能每帧重跑避让检测 */
  const coordsRef = useRef({ x, y, bottom });
  const placementRef = useRef(placement);
  // 每次渲染后同步最新值给定时器（react-hooks/refs 禁止渲染期写 ref）
  useEffect(() => {
    coordsRef.current = { x, y, bottom };
    placementRef.current = placement;
  });
  const clampedX = clampButtonX(x);
  const top = placement === 'above' ? Math.max(8, y - 6) : bottom + 6;

  // 静默期：每 50ms 复查一次；宿主气泡一现身就换到空侧并首次显示
  useEffect(() => {
    const start = Date.now();
    const timers: number[] = [];
    const tick = () => {
      const { x: cx, y: cy, bottom: cb } = coordsRef.current;
      const next = decidePlacement(cx, cy, cb);
      if (next !== placementRef.current) {
        placementRef.current = next;
        setPlacementState(next);
        setRevealed(true);
        return;
      }
      if (Date.now() - start >= SETTLE_MS) {
        setRevealed(true);
        return;
      }
      timers.push(window.setTimeout(tick, POLL_MS));
    };
    tick();
    return () => timers.forEach((t) => clearTimeout(t));
  }, []);

  // 兜底复检：比静默期更晚出现的宿主气泡仍会被挪开
  useEffect(() => {
    const timers = [400, 1000].map((delay) =>
      window.setTimeout(() => {
        const { x: cx, y: cy, bottom: cb } = coordsRef.current;
        if (!isRectCoveredByHostUI(candidateRect(placement, cx, cy, cb))) return;
        const other: Placement = placement === 'above' ? 'below' : 'above';
        if (!isRectCoveredByHostUI(candidateRect(other, cx, cy, cb))) {
          placementRef.current = other;
          setPlacementState(other);
        }
      }, delay)
    );
    return () => timers.forEach((t) => clearTimeout(t));
  }, [placement]);

  return (
    <button
      className={`crow-btn${placement === 'below' ? ' below' : ''}`}
      style={{ left: clampedX, top, visibility: revealed ? 'visible' : 'hidden' }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      这是啥？
    </button>
  );
}
