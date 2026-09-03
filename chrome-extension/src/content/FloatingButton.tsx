import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { clampButtonX, decidePlacement, type Placement } from './floating-placement';
import { resolveAnchorMode, viewportToDocument } from './floating-anchor';

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

// 锚定模式：滚动停止后多久才允许 JS 重新校验坐标。
// 滚动期间**一律不写 DOM**——这是根治合成器相位差的关键，一旦在滚动中写坐标，
// 就会把主线程读到的滞后坐标盖到已经滚到位的内容上，晃动原样回来。
const SCROLL_QUIET_MS = 140;
// 锚定模式：静止期的低频校验间隔（只纠图片加载 / 折叠展开等 reflow 造成的偏移）
const VERIFY_INTERVAL_MS = 200;

// 估算按钮尺寸，与 floating-placement 的 candidateRect 保持一致，保证视觉落位与检测一致
const BTN_H = 32;
const BTN_GAP = 6;

const COMMON_STYLE: CSSProperties = {
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
  // 用 transform 而非 left/top 定位：位移平滑、亚像素对齐。
  // 注意：**不要加 will-change:transform**——它会把气泡强行推上独立合成层，
  // 而选区文字在主文档层；两者在连续滚动时亚像素栅格对齐会差出零点几像素，
  // 表现为「气泡相对文字轻微上下晃」（x.com/GPT 等超重 SPA 上尤其明显）。
  // 不强制合成层时，气泡与文字处于同一渲染层、栅格化节奏一致，反而更稳。
  // left/top 归零为固定锚点，位移全部交给 transform。
  left: 0,
  top: 0,
};

/**
 * 锚定模式：absolute 挂进 body 文档流，用文档坐标定位。
 * 滚动时浏览器把气泡当作页面内容一起合成滚动，JS 零参与 → 相位差归零。
 */
const STYLE_ANCHORED: CSSProperties = { ...COMMON_STYLE, position: 'absolute' };

/** 回退模式：fixed 钉在视口，靠 rAF + scroll 双路每帧跟随选区。 */
const STYLE_FIXED: CSSProperties = { ...COMMON_STYLE, position: 'fixed' };

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
 * content script 注入每个 frame（manifest all_frames:true），浮标与选区通常同文档，
 * 直接用 range 的本帧坐标即可；仅当选区在别的文档（跨 frame 取到 range）才把
 * iframe 偏移换算进浮标视口，避免坐标 double-offset。
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
 * 划词浮标。两种定位模式，二选一且在挂载时定死：
 *
 * - **anchored（DOM 锚定，默认优先）**：`position: absolute` 挂进 body 文档流，
 *   用文档坐标落位。滚动时气泡就是页面内容的一部分，浏览器合成滚动时把它和
 *   文字一起搬走，**JS 完全不参与** —— 这治的是「合成器滚动 vs 主线程读坐标」
 *   的相位差，即 x.com 这类站点上气泡相对文字轻微晃动的根因。JS 跟随无论多勤
 *   都跨不过这道坎，只能靠让浏览器自己搬。
 * - **fixed（回退）**：文档结构不干净（祖先 fixed/sticky/内部滚动容器/独立合成层，
 *   或 body/html 创建 containing block，或跨 frame 选区）时，气泡无法锚进文档流，
 *   退回「rAF 循环 + scroll 同步」每帧读选区屏幕坐标写 transform 的老方案。
 *
 * 两种模式都不依赖 React state 更新位置（ref 直写 DOM，零重渲染＝零抖动）；
 * 换一段划词时父组件用新 key 重挂载本组件，range 换新、旧气泡消失、新气泡锁在新词。
 */
export default function FloatingButton({ x, y, bottom, range, onClick }: Props) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const rangeRef = useRef(range);

  // 定位模式只判定一次：选区 DOM 结构在本组件生命周期内不变，
  // 真变了（换词）父组件会用新 key 重挂载。
  // 用 useState 惰性初始化而非 ref——ref.current 在 render 期读会踩 react-hooks/refs。
  const [decision] = useState(() => resolveAnchorMode(range, document));

  const placementRef = useRef<Placement>('above');
  const flipsRef = useRef(0);
  const updateRef = useRef<() => void>(() => {});
  const [revealed, setRevealed] = useState(false);

  // render 期写 ref 同样踩 react-hooks/refs：放在所有定位 effect 之前同步最新 range，
  // 保证下面的跟随逻辑（rAF / scroll 回调）读到的都是当前选区。
  useLayoutEffect(() => {
    rangeRef.current = range;
  }, [range]);

  // 挂载即落位 + 跟随选区文字（直接写 DOM，零 React 重渲染＝零抖动）
  useLayoutEffect(() => {
    const el = btnRef.current;
    if (!el) return;
    const { mode, reason } = decision;

    // 真机可观测：x.com 上应看到 mode=anchored reason=ok。若回退 fixed，
    // reason 会直接指出是哪位祖先不干净（fixed / sticky / scrollable / own-layer）。
    console.info('[crow-anchor] mode=', mode, 'reason=', reason);

    function write(cx: number, top: number) {
      if (mode === 'anchored') {
        const d = viewportToDocument(el.ownerDocument, cx, top);
        el.style.transform = `translate(${d.x}px, ${d.y}px) translateX(-50%)`;
      } else {
        el.style.transform = `translate(${cx}px, ${top}px) translateX(-50%)`;
      }
    }

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
        write(
          clampButtonX(rect.cx),
          computeTop(placementRef.current, rect.top, rect.bottom)
        );
      } catch {
        // range 完全失效（选区 DOM 被页面卸载）：保持上次位置，不跳到 (0,0)
      }
    }
    updateRef.current = update;

    // 初始落位用 props 的固定坐标（兼容挂靠延迟 / 挂载时已是滚动态）
    write(clampButtonX(x), computeTop(placementRef.current, y, bottom));

    let raf = 0;
    let lastScrollAt = 0;
    let lastVerifyAt = 0;

    if (mode === 'anchored') {
      // 锚定模式：滚动期间**绝不**写坐标，让浏览器把气泡和文字一起搬。
      // 只在滚动停稳后做低频校验，纠正图片加载 / 折叠展开等 reflow 造成的偏移
      // （静止时没有相位差，此时读坐标写 DOM 完全安全）。
      const markScroll = () => {
        lastScrollAt = Date.now();
      };
      const tick = () => {
        raf = requestAnimationFrame(tick);
        const now = Date.now();
        if (now - lastScrollAt < SCROLL_QUIET_MS) return;
        if (now - lastVerifyAt < VERIFY_INTERVAL_MS) return;
        lastVerifyAt = now;
        update();
      };
      raf = requestAnimationFrame(tick);
      window.addEventListener('scroll', markScroll, { capture: true, passive: true });
      window.addEventListener('resize', () => {
        lastVerifyAt = 0; // 尺寸变了文字会重排，立即校验一次
        update();
      });

      return () => {
        if (raf) cancelAnimationFrame(raf);
        window.removeEventListener('scroll', markScroll, true);
      };
    }

    // 回退模式：两路跟随，互补覆盖两种滚动形态。
    // 1) 持续 rAF 循环：覆盖「滚动但不派发 scroll 事件」的场景（transform 模拟滚动、
    //    部分 SPA 把滚动交给合成器）。这类场景只能靠每帧主动读坐标。
    // 2) scroll/resize 同步更新：真实（原生/容器）滚动会派发 scroll 事件，且浏览器在
    //    「本帧滚动量应用之后、rAF 之前」才派发它——在 scroll 里同步读选区坐标写
    //    transform，气泡与本帧滚动同帧落位，消除 rAF 那种「慢半帧」导致的上下晃动。
    const onScrollOrResize = () => update();
    const tick = () => {
      update();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    window.addEventListener('scroll', onScrollOrResize, { capture: true, passive: true });
    window.addEventListener('resize', onScrollOrResize);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [x, y, bottom, decision]);

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
      // data-crow-fab：避让检测靠它把自己排除在外，否则浮标
      // 会被判定成「宿主浮动 UI」而反复上下翻转（普通网页上下跳动的根因）
      data-crow-fab="1"
      style={{
        ...(decision.mode === 'anchored' ? STYLE_ANCHORED : STYLE_FIXED),
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
