import { useEffect, useRef, useState } from 'react';
import {
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
  onClick: () => void;
}

/** 宿主气泡（如 ChatGPT）常在划词后 ~200-300ms 才弹出：静默期内先藏着等它现身 */
const SETTLE_MS = 300;
const POLL_MS = 50;

export default function FloatingButton({ x, y, bottom, onClick }: Props) {
  /** 宿主气泡压得住任何 z-index，只能挑空位 */
  const [placement, setPlacementState] = useState<Placement>(() => decidePlacement(x, y, bottom));
  const placementRef = useRef(placement);
  const [revealed, setRevealed] = useState(false);
  const clampedX = clampButtonX(x);
  const top = placement === 'above' ? Math.max(8, y - 6) : bottom + 6;

  // 静默期：每 50ms 复查一次；宿主气泡一现身就换到空侧并首次显示，避免「先被挡再跳开」；
  // 到点仍无冲突则原位显示
  useEffect(() => {
    const start = Date.now();
    const timers: number[] = [];
    const tick = () => {
      const next = decidePlacement(x, y, bottom);
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
  }, [x, y, bottom]);

  // 兜底复检：比静默期更晚出现的宿主气泡仍会被挪开
  useEffect(() => {
    const timers = [400, 1000].map((delay) =>
      window.setTimeout(() => {
        if (!isRectCoveredByHostUI(candidateRect(placement, x, y, bottom))) return;
        const other: Placement = placement === 'above' ? 'below' : 'above';
        if (!isRectCoveredByHostUI(candidateRect(other, x, y, bottom))) {
          placementRef.current = other;
          setPlacementState(other);
        }
      }, delay)
    );
    return () => timers.forEach((t) => clearTimeout(t));
  }, [placement, x, y, bottom]);

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
