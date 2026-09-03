import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { clampButtonX, decidePlacement, type Placement } from './floating-placement';

// [DEBUG] 模块级挂载计数：气泡每被 React 用新 key 重挂载就 +1。
// 滚动时若暴增（如每秒几十次），说明站点（虚拟列表/重渲染）在频繁替换选区文本节点、
// 触发 selectionchange → App 重提交 → 浮标卸载重挂，是「晃/闪」的强信号。
let mountSeq = 0;

interface Props {
  /** 选区中心 x（视口坐标，初始落位用） */
  x: number;
  /** 选区顶边（视口坐标，初始落位用） */
  y: number;
  /** 选区底边（视口坐标，初始落位用） */
  bottom: number;
  /** 选区 Range 快照：滚动/缩放时实时读它的屏幕坐标，让气泡和词锁在一起 */
  range: Range;
  onClick: () => void;
}

// 宿主划词气泡（ChatGPT 等）常在划词后 ~200-300ms 才弹出：静默期内先藏着等它现身，
// 轮询找空位；一旦躲开就提前现身，静默期满无条件现身。
const SETTLE_MS = 300;
// 复查时间点（ms，自挂载起）：静默期内密集轮询，之后两次兜底，末点之后一律不再动
const CHECKPOINTS_MS = [50, 100, 150, 200, 250, 300, 400, 1000];
// 收摊时刻：比最后一次复查略晚，保证所有复查都已执行
const STOP_MS = 1050;
// 整个生命周期最多翻转次数：任何异常都不可能退化成无限上下横跳
const MAX_FLIPS = 2;

// 估算按钮尺寸，与 floating-placement 的 candidateRect 保持一致，保证视觉落位与检测一致
const BTN_H = 32;
const BTN_GAP = 6;

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
  // 用 transform 而非 left/top 定位：fixed + translate 位移平滑、亚像素对齐。
  // 注意：**不要加 will-change:transform**——它会把气泡强行推上独立合成层，
  // 而选区文字在主文档层；两者在连续滚动时亚像素栅格对齐会差出零点几像素，
  // 表现为「气泡相对文字轻微上下晃」（x.com/GPT 等超重 SPA 上尤其明显）。
  // 不强制合成层时，气泡与文字处于同一渲染层、栅格化节奏一致，反而更稳。
  // left/top 归零为固定锚点，位移全部交给 transform。
  left: 0,
  top: 0,
};

/** 按上下侧算按钮 top（above：词上方留 GAP；below：词下方）。
 *  不做垂直钳制：气泡与被划的词「锁在一起」，选区滚出视口顶部/底部时
 *  气泡也随之滚出（相对静止）；若在此钳制会破坏锁定、与词脱钩。 */
function computeTop(placement: Placement, topY: number, bottomY: number): number {
  return placement === 'above'
    ? topY - BTN_GAP - BTN_H
    : bottomY + BTN_GAP;
}

/**
 * range 相对「浮标所在文档视口」的矩形。
 * content script 注入每个 frame（manifest all_frames:true），浮标与选区总在同一文档，
 * 直接用 range 的本帧坐标即可（fixed 相对的正是本帧视口）；仅当选区在别的文档
 * （跨 frame 取到 range）才把 iframe 偏移换算进浮标视口，避免坐标 double-offset。
 */
function readRangeRect(range: Range, hostDoc: Document): { cx: number; top: number; bottom: number } {
  const r = range.getBoundingClientRect();
  const rangeDoc = range.startContainer.ownerDocument;
  if (rangeDoc === hostDoc || !rangeDoc?.defaultView?.frameElement) {
    return { cx: r.left + r.width / 2, top: r.top, bottom: r.bottom };
  }
  const frame = rangeDoc.defaultView!.frameElement as HTMLElement;
  const fr = frame.getBoundingClientRect();
  return {
    cx: r.left + fr.left + r.width / 2,
    top: r.top + fr.top,
    bottom: r.bottom + fr.top,
  };
}

/** 选区节点是否已脱离文档（站点重渲染替换了文本节点）。脱离后 getBoundingClientRect 返回全 0。 */
function isRangeDetached(range: Range): boolean {
  const node = range.startContainer;
  return !(node instanceof Node) || !node.isConnected;
}

/**
 * 划词浮标。position:fixed 钉在屏幕上，但**位置实时跟随选区文字**：
 * 用「持续 rAF 循环 + scroll 同步更新」两路读选区 Range 的屏幕坐标，直接写 DOM 的 transform
 * （fixed + translate，走合成层、亚像素对齐，避免 left/top 触发布局导致的滚动亚像素抖动）——
 * rAF 兜底「不派发 scroll 事件的 transform 滚动」，scroll 回调消除 rAF 慢半帧的上下晃动；
 * 不依赖 scroll 事件，因此原生滚动 / 平滑滚动 / 滚动容器 / transform 模拟滚动
 * 都能让气泡和被划的词「锁在一起」一起移动，相对静止、不脱钩、不随滚动漂移。
 *
 * 跟随走 ref 直接改 DOM 而非 React state，零重渲染＝零抖动；不进 React 协调，
 * 也就没有锚点定位（CSS Anchor Positioning）在宿主重渲染时抹掉内联样式导致的闪烁。
 * 换一段划词时父组件用新 key 重挂载本组件，range 换新、旧气泡消失、新气泡锁在新词。
 */
export default function FloatingButton({ x, y, bottom, range, onClick }: Props) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const rangeRef = useRef(range);
  rangeRef.current = range;

  const placementRef = useRef<Placement>('above');
  const flipsRef = useRef(0);
  const updateRef = useRef<() => void>(() => {});
  const [revealed, setRevealed] = useState(false);

  // 挂载即落位 + 每帧跟随选区文字（直接写 DOM，零 React 重渲染＝零抖动）
  useLayoutEffect(() => {
    const el = btnRef.current;
    if (!el) return;
    mountSeq += 1;
    const myMount = mountSeq;

    function update() {
      try {
        const hostDoc = el.ownerDocument;
        let rect = readRangeRect(rangeRef.current, hostDoc);
        // 选区节点可能被站点重渲染替换（React 重渲染 / 虚拟列表）：克隆 range 脱离文档、
        // getBoundingClientRect 返回全 0。此时回退到「当前实时选区」再读一次——
        // 用户滚动时通常仍持有选区，实时 range 指向当前文本节点、坐标有效。
        if (isRangeDetached(rangeRef.current)) {
          const sel = hostDoc.defaultView?.getSelection?.();
          if (sel && sel.rangeCount > 0) {
            const live = readRangeRect(sel.getRangeAt(0), hostDoc);
            if (!(live.cx === 0 && live.top === 0 && live.bottom === 0)) rect = live;
          }
        }
        // 选区折叠/失效、且实时选区也读不到：保持上次落位，不跳角、不消失
        if (rect.cx === 0 && rect.top === 0 && rect.bottom === 0) return;
        el.style.transform = `translate(${clampButtonX(rect.cx)}px, ${computeTop(
          placementRef.current,
          rect.top,
          rect.bottom
        )}px) translateX(-50%)`;
      } catch {
        // range 完全失效（选区 DOM 被页面卸载）：保持上次位置，不跳到 (0,0)
      }
    }
    updateRef.current = update;

    // 初始落位用 props 的固定坐标（兼容挂靠延迟 / 挂载时已是滚动态）
    el.style.transform = `translate(${clampButtonX(x)}px, ${computeTop(
      placementRef.current,
      y,
      bottom
    )}px) translateX(-50%)`;

    // 两路跟随，互补覆盖两种滚动形态：
    // 1) 持续 rAF 循环：覆盖「滚动但不派发 scroll 事件」的场景（transform 模拟滚动、
    //    部分 SPA 把滚动交给合成器）。这类场景只能靠每帧主动读坐标。
    // 2) scroll/resize 同步更新：真实（原生/容器）滚动会派发 scroll 事件，且浏览器在
    //    「本帧滚动量应用之后、rAF 之前」才派发它——在 scroll 里同步读选区坐标写
    //    transform，气泡与本帧滚动同帧落位，消除 rAF 那种「慢半帧」导致的上下晃动；
    //    resize 同理（窗口尺寸变了选区视口坐标也要重算）。
    let raf = 0;
    const tick = () => {
      update();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    const onScrollOrResize = () => update();
    window.addEventListener('scroll', onScrollOrResize, { capture: true, passive: true });
    window.addEventListener('resize', onScrollOrResize);

    // [DEBUG] 诊断滚动晃动真因（确认后即删，仅前 10s 采样）。
    // gap = 气泡实际 top − 选区 top：理想恒 = -(BTN_GAP+BTN_H) = -38。
    //   gap 在滚动时**偏离 -38 且波动** → 气泡相对文字在抖（层间亚像素错位 / rAF 相位差）
    //   gap 稳定 -38 但 selTop 自身在抖 → 选区文字被页面 reflow 带着抖（DOM 锚定才治）
    // mountSeq 滚动时暴增 → selectionchange 高频触发浮标卸载重挂（虚拟列表替换节点）
    const diagStart = Date.now();
    let lastDiag = 0;
    let diagHeaderLogged = false;
    let diagRaf = 0;
    const diagTick = () => {
      if (Date.now() - diagStart > 10000) return;
      const now = Date.now();
      if (now - lastDiag >= 250) {
        lastDiag = now;
        const csBody = getComputedStyle(document.body);
        const csHtml = getComputedStyle(document.documentElement);
        const tr = readRangeRect(rangeRef.current, el.ownerDocument);
        const btnRect = el.getBoundingClientRect();
        const expectedTop = computeTop(placementRef.current, tr.top, tr.bottom);
        const gap = btnRect.top - tr.top;
        const drift = btnRect.top - expectedTop;
        if (!diagHeaderLogged) {
          diagHeaderLogged = true;
          console.info(
            '[crow-diag] body.transform=',
            csBody.transform,
            'html.transform=',
            csHtml.transform,
            'body.willChange=',
            csBody.willChange,
            'body.filter=',
            csBody.filter
          );
        }
        console.info(
          '[crow-diag] mountSeq=',
          myMount,
          'selTop=',
          tr.top.toFixed(2),
          'btnTop=',
          btnRect.top.toFixed(2),
          'gap=',
          gap.toFixed(2),
          'drift=',
          drift.toFixed(2)
        );
      }
      diagRaf = requestAnimationFrame(diagTick);
    };
    diagRaf = requestAnimationFrame(diagTick);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (diagRaf) cancelAnimationFrame(diagRaf);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [x, y, bottom]);

  // 静默期等宿主气泡现身 + 有限次翻转避让；翻转只改 placementRef，位置由 update 实时跟随
  useEffect(() => {
    const mountedAt = Date.now();
    const timers: number[] = [];
    let stopped = false;

    function clearAll() {
      stopped = true;
      timers.forEach((t) => window.clearTimeout(t));
    }

    function check() {
      if (stopped) return;
      if (Date.now() - mountedAt >= SETTLE_MS) setRevealed(true);
      const next = decidePlacement(x, y, bottom);
      if (next !== placementRef.current && flipsRef.current < MAX_FLIPS) {
        flipsRef.current += 1;
        placementRef.current = next;
        setRevealed(true);
        updateRef.current(); // 按新上下侧立即落位
      }
    }

    for (const at of CHECKPOINTS_MS) timers.push(window.setTimeout(check, at));
    timers.push(window.setTimeout(clearAll, STOP_MS));
    return clearAll;
  }, [x, y, bottom]);

  return createPortal(
    <button
      ref={btnRef}
      // class 仅作测试/调试选择器句柄；亮 DOM 中样式全部内联（shadow 样式不适用）
      className="crow-btn"
      // data-crow-fab：避让检测靠它把自己排除在外，否则 fixed + 最大 z-index 的浮标
      // 会被判定成「宿主浮动 UI」而反复上下翻转（普通网页上下跳动的根因）
      data-crow-fab="1"
      style={{
        ...BASE_STYLE,
        visibility: revealed ? 'visible' : 'hidden',
      }}
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
