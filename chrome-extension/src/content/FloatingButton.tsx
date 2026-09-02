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
  /** 划词 Range：锚点定位模式下据此插入锚点 span */
  range?: Range;
  onClick: () => void;
}

/** 宿主气泡（如 ChatGPT）常在划词后 ~200-300ms 才弹出：静默期内先藏着等它现身 */
const SETTLE_MS = 300;
const POLL_MS = 50;
const ANCHOR_A = '--crow-sel-a';
const ANCHOR_B = '--crow-sel-b';

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
  // ChatGPT 划词气泡同款：CSS Anchor Positioning——锚点在内容流里随内容被原生滚动，
  // 浏览器同帧重定位按钮，无 JS 参与、零抖动。不支持时回退 fixed + JS 跟随。
  if (ANCHOR_OK && props.range) {
    return <AnchoredButton {...props} />;
  }
  return <FixedButton {...props} />;
}

function makeAnchorSpan(name: string): HTMLSpanElement {
  const s = document.createElement('span');
  s.style.cssText = `position:relative;display:inline-block;width:0;height:0;anchor-name:${name};`;
  return s;
}

/** 锚点定位版：渲染进亮 DOM（position-anchor 不能跨 shadow 边界引用） */
function AnchoredButton({ x, y, bottom, range, onClick }: Props) {
  const [placement, setPlacement] = useState<Placement>('above');
  const [revealed, setRevealed] = useState(false);
  const [orphaned, setOrphaned] = useState(false);
  const [anchorFailed, setAnchorFailed] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const anchorsRef = useRef<{ a: HTMLSpanElement; b: HTMLSpanElement } | null>(null);
  const placementRef = useRef(placement);

  // 划词起止各插一个 0 尺寸锚点 span；卸载时移除，页面 DOM 还原。
  // 仅挂载时插一次：若依赖 range 对象，锚点插入引发的 selectionchange 会再造一个新
  // range 触发重插，形成「拆锚点→selectionchange→重插」的闪烁循环。
  // 插入放进定时器回调：setState 不能出现在 effect 同步体（react-hooks/set-state-in-effect）
  useEffect(() => {
    if (!range) return;
    let inserted: { a: HTMLSpanElement; b: HTMLSpanElement } | null = null;
    const t = window.setTimeout(() => {
      const a = makeAnchorSpan(ANCHOR_A);
      const b = makeAnchorSpan(ANCHOR_B);
      try {
      const ra = range.cloneRange();
      ra.collapse(true);
      ra.insertNode(a);
      const rb = range.cloneRange();
      rb.collapse(false);
      rb.insertNode(b);
      // insertNode 会打断浏览器选区（App 二次读选区将得到 null 而误卸载按钮）：
      // 用锚点位置立即重建原选区，同一 tick 内完成，视觉无感
      const doc = a.ownerDocument;
      const sel = doc.getSelection();
      if (sel) {
        const restored = doc.createRange();
        const pa = a.parentNode!;
        const pb = b.parentNode!;
        restored.setStart(pa, Array.prototype.indexOf.call(pa.childNodes, a));
        restored.setEnd(pb, Array.prototype.indexOf.call(pb.childNodes, b) + 1);
        sel.removeAllRanges();
        sel.addRange(restored);
      }
      } catch {
        setAnchorFailed(true);
        return;
      }
      inserted = { a, b };
      anchorsRef.current = inserted;
    }, 0);
    return () => {
      clearTimeout(t);
      if (inserted) {
        inserted.a.remove();
        inserted.b.remove();
      }
      anchorsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 见上：仅挂载时插一次
  }, []);

  // 布局：anchor() 定位，水平取起止锚点中点，上/下由 placement 决定
  useEffect(() => {
    const el = btnRef.current;
    if (!el) return;
    el.style.left = `calc((anchor(${ANCHOR_A} center) + anchor(${ANCHOR_B} center)) / 2)`;
    if (placement === 'above') {
      el.style.top = `anchor(${ANCHOR_A} top)`;
      el.style.translate = '-50% calc(-100% - 6px)';
    } else {
      el.style.top = `anchor(${ANCHOR_B} bottom)`;
      el.style.translate = '-50% 6px';
    }
  }, [placement]);

  /** 锚点矩形 → 当前选区坐标（滚动后仍准确）；锚点失效返回 null */
  const currentCoords = useCallback((): { x: number; y: number; bottom: number } | null => {
    const an = anchorsRef.current;
    if (!an || !an.a.isConnected || !an.b.isConnected) return null;
    const ra = an.a.getBoundingClientRect();
    const rb = an.b.getBoundingClientRect();
    return {
      x: (ra.left + ra.right + rb.left + rb.right) / 4,
      y: Math.min(ra.top, rb.top),
      bottom: Math.max(ra.bottom, rb.bottom),
    };
  }, []);

  // 静默期：等宿主气泡现身再首现，避免「先被挡再跳开」
  useEffect(() => {
    const start = Date.now();
    const timers: number[] = [];
    const tick = () => {
      const an = anchorsRef.current;
      if (an && (!an.a.isConnected || !an.b.isConnected)) {
        // 页面重渲染毁掉了锚点：隐藏按钮
        setOrphaned(true);
        setRevealed(true);
        return;
      }
      if (!an) {
        // 锚点尚未插入完成，稍后再查
        if (Date.now() - start >= SETTLE_MS) {
          setRevealed(true);
          return;
        }
        timers.push(window.setTimeout(tick, POLL_MS));
        return;
      }
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

  // 兜底复检：更晚出现的宿主气泡仍会被挪开
  useEffect(() => {
    const timers = [400, 1000].map((delay) =>
      window.setTimeout(() => {
        if (!anchorsRef.current) return;
        const c = currentCoords();
        if (!c) {
          setOrphaned(true);
          return;
        }
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
      style={{ ...BASE_STYLE, visibility: revealed && !orphaned ? 'visible' : 'hidden' }}
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
