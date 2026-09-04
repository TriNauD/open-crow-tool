import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { clampButtonX, decidePlacement, type Placement } from './floating-placement';
import {
  anchorCoords,
  isClippedByHost,
  resolveAnchorMode,
  DRIFT_MAX_STRIKES,
  DRIFT_NOISE_PX,
  type AnchorMode,
} from './floating-anchor';

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
/** 容器级锚定：气泡 absolute 挂进宿主内部，宿主必须是定位上下文；内部滚动容器通常
 * 是 position:static，这里补一个 relative（不改动布局、只创建定位上下文）。返回
 * 原始内联 position 以便卸载时还原；本来就是定位上下文则返回 null。 */
function ensurePositioningContext(el: HTMLElement): string | null {
  if (getComputedStyle(el).position === 'static') {
    const prev = el.style.position;
    el.style.position = 'relative';
    return prev;
  }
  return null;
}

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
 * 划词浮标。两种定位模式：
 *
 * - **anchored（DOM 锚定，默认优先）**：`position: absolute` 挂进**选区所在的滚动
 *   容器**（页面级场景退化为挂 `body`），用局部/文档坐标落位。滚动时气泡就是
 *   内容的一部分，浏览器合成滚动时把它和文字一起搬走，**JS 完全不参与** —— 这治的
 *   是「合成器滚动 vs 主线程读坐标」的相位差。这正是对症 ds / chatgpt 的修复：
 *   它们的消息区是独立滚动容器，旧逻辑把气泡挂 `body` 不跟内容滚、退化 `fixed`
 *   仍有相位差，现在锚进消息容器随它一起滚。JS 跟随无论多勤都跨不过这道坎，
 *   只能靠让浏览器自己搬。
 *
 *   锚定期间只做一件事：滚动停稳后低频测一次「气泡顶边 − 选区顶边」。这个值
 *   锚定成立时必须恒定，漂了就说明气泡与文字脱钩（祖先变换在滚动中动态变化），
 *   自动降级到 fixed。所以**锚定是带自检的乐观策略**：先赌能锚住，赌错自动退回，
 *   不会比不锚定更差。
 *
 * - **fixed（回退）**：文档结构不允许锚定（祖先 fixed/sticky/内部滚动容器，
 *   或 body/html 创建 containing block，或跨 frame 选区），或运行时自检判定
 *   脱钩时，退回「rAF 循环 + scroll 同步」每帧读选区屏幕坐标写 transform 的老方案。
 *
 * 两种模式都不依赖 React state 更新位置（ref 直写 DOM，零重渲染＝零抖动）；
 * 换一段划词时父组件用新 key 重挂载本组件，range 换新、旧气泡消失、新气泡锁在新词。
 * 模式只在挂载时定死 + 单向降级（anchored → fixed，不反向），不会来回横跳。
 */
export default function FloatingButton({ x, y, bottom, range, onClick }: Props) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const rangeRef = useRef(range);

  // 定位模式只判定一次：选区 DOM 结构在本组件生命周期内不变，
  // 真变了（换词）父组件会用新 key 重挂载。
  // 用 useState 惰性初始化而非 ref——ref.current 在 render 期读会踩 react-hooks/refs。
  // mode 单独可降级：挂载判定允许 transform/filter 祖先（见 floating-anchor），
  // 但祖先变换若在滚动中动态变化（虚拟滚动），文字动而气泡不动 → 运行时自检发现
  // 偏移对不上基准，就把 mode 降到 fixed 走跟随兜底。
  const [anchor, setAnchor] = useState(() => {
    const d = resolveAnchorMode(range, document);
    return { decision: d, mode: d.mode as AnchorMode, host: d.host };
  });
  const { decision, host } = anchor;
  const mode = anchor.mode;

  const placementRef = useRef<Placement>('above');
  /** 被容器裁剪限定死的上下侧：非空时禁止避让逻辑再翻走（翻回去按钮又被切掉） */
  const clipLockedRef = useRef<Placement | null>(null);
  const flipsRef = useRef(0);
  const updateRef = useRef<() => void>(() => {});
  /** 锚定自检基准：gap（气泡−文字的相对偏移）+ 文字的文档纵坐标 */
  const baselineRef = useRef<{ gap: number; textLocalY: number } | null>(null);
  const strikesRef = useRef(0);
  const degradedRef = useRef(false);
  const firstRunRef = useRef(true);
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
    // hostEl 必须先声明（下方 console 与容器级逻辑都要用），否则会踩 TDZ
    const hostEl = host as HTMLElement;
    // 真机可观测：x.com 上应看到 mode=anchored reason=ok；AI 对话站消息区锚定时应
    // 看到 reason=scroll-host-div（bubble 挂在消息滚动容器里随它滚）。若回退 fixed，
    // reason 会直接指出是哪位祖先不干净（fixed / sticky）。
    console.info(
      '[crow-anchor] mode=',
      mode,
      'reason=',
      decision.reason,
      'host=',
      host === el.ownerDocument.body ? 'body' : (hostEl.tagName || 'el').toLowerCase()
    );

    // 容器级锚定：气泡 absolute 挂进宿主内部，宿主必须是定位上下文，否则 absolute
    // 会相对初始包含块而非宿主 → 锚定失效。内部滚动容器通常是 position:static，
    // 这里补一个 relative（不改动布局，只创建定位上下文），卸载时还原。
    // body 作为宿主时无需此处理（气泡本就相对初始包含块）。
    let restoredHostPos: string | null = null;
    if (mode === 'anchored' && host !== el.ownerDocument.body) {
      restoredHostPos = ensurePositioningContext(hostEl);
    }

    // 锚定失效时降级：若祖先的变换在滚动中动态变化（虚拟滚动 / transform 模拟
    // 滚动），文字随变换走而 absolute 气泡不动 → 脱钩。静态还是动态挂载时判不出，
    // 只能运行时发现「气泡与文字的相对偏移对不上基准」后降级。
    // 降级只是回到今天的行为，不会更差。
    function degrade(why: string) {
      if (degradedRef.current) return;
      degradedRef.current = true;
      console.warn('[crow-anchor] degrade → fixed:', why);
      setAnchor((a) => (a.mode === 'fixed' ? a : { ...a, mode: 'fixed' }));
    }

    function write(cx: number, top: number) {
      if (mode === 'anchored') {
        const win = el.ownerDocument.defaultView;
        if (!win) return;
        // 容器级锚定用宿主局部坐标，页面级用文档坐标（anchorCoords 内部按 host 区分）
        const d = anchorCoords(host, top, cx, win);
        el.style.transform = `translate(${d.x}px, ${d.y}px) translateX(-50%)`;
      } else {
        el.style.transform = `translate(${cx}px, ${top}px) translateX(-50%)`;
      }
    }

    /** 选区当前矩形；读不到（range 失效且无实时选区）返回 null */
    function readRect() {
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
        // 选区折叠/失效、且实时选区也读不到
        if (rect.cx === 0 && rect.top === 0 && rect.bottom === 0) return null;
        return rect;
      } catch {
        // range 完全失效（选区 DOM 被页面卸载）
        return null;
      }
    }

    function update() {
      const rect = readRect();
      // 读不到就保持上次落位，不跳角、不消失
      if (!rect) return;
      write(
        clampButtonX(rect.cx),
        computeTop(placementRef.current, rect.top, rect.bottom)
      );
    }
    updateRef.current = update;

    /**
     * 自检探针。gap = 气泡顶边 − 选区顶边（都是视口坐标）；锚定成立时它必须恒定
     * （气泡和文字一起滚，视口坐标差不变）。textLocalY = 选区在**宿主内容坐标系**
     * 里的纵向位置；它变了说明文字自己在文档里挪了窝（reflow），而非锚定脱钩。
     */
    function measure(): { gap: number; textLocalY: number } | null {
      const rect = readRect();
      if (!rect) return null;
      const gap = el.getBoundingClientRect().top - rect.top;
      let textLocalY: number;
      if (host === el.ownerDocument.body) {
        const win = el.ownerDocument.defaultView;
        textLocalY = rect.top + (win ? win.scrollY : 0);
      } else {
        const hr = hostEl.getBoundingClientRect();
        textLocalY = rect.top - hr.top - hostEl.clientTop + hostEl.scrollTop;
      }
      return { gap, textLocalY };
    }

    // 初始落位：挂载时用 props 的固定视口坐标（兼容挂靠延迟 / 挂载时已是滚动态）；
    // 模式切换（anchored → fixed 降级）时 props 坐标早已过期，必须按实时坐标重算，
    // 否则气泡会瞬间跳回挂载时的位置。
    if (firstRunRef.current) {
      firstRunRef.current = false;
      write(clampButtonX(x), computeTop(placementRef.current, y, bottom));
      // 容器级锚定把气泡变成了宿主的裁剪对象：默认放上方时，选区在容器顶部第一行
      // 就会顶出容器上沿被切掉。先试翻到另一侧，两侧都放不下才降级——降级 = 回到挂
      // body 的旧行为，至少气泡是完整可见的（宁可晃，不能看不见）。
      if (mode === 'anchored' && hostEl !== el.ownerDocument.body && isClippedByHost(hostEl, el)) {
        placementRef.current = placementRef.current === 'above' ? 'below' : 'above';
        write(clampButtonX(x), computeTop(placementRef.current, y, bottom));
        if (isClippedByHost(hostEl, el)) {
          degrade('bubble clipped by scroll host');
        } else {
          // 这一侧是「不被裁」的唯一解，锁住：否则 50ms 后的避让复查会按视口
          // 判定翻回被裁的那一侧，按钮又看不见了。
          clipLockedRef.current = placementRef.current;
        }
      }
    } else {
      update();
    }

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

      /**
       * 静止期校验：纠 reflow 偏移 + 自检锚定是否还成立。
       *
       * gap 漂了有两种截然不同的原因，判据是**文字自己有没有挪窝**：
       * - 文字文档坐标也变了 → 纯 reflow（图片懒加载撑开高度 / 折叠展开 / 内容
       *   高度变化）。文字确实换了地方，重新落位即可，锚定本身没坏，基准跟着更新。
       *   x.com 滚动时疯狂懒加载图片，这种漂移量可能是几百 px，按大小判会把
       *   正常 reflow 全误杀成脱钩。
       * - 文字没挪、只有 gap 漂了 → 气泡没跟着文字走，即祖先变换在滚动中变化
       *   （虚拟滚动 / transform 模拟滚动），锚定前提不成立，降级。
       */
      const verify = () => {
        // 宿主被站点整体换掉（虚拟列表回收 / 消息区重挂载）：气泡挂在 detached 节点上
        // 等于永久消失，锚定前提没了 → 降级到跟随，至少还能看见。
        if (!hostEl.isConnected) {
          degrade('scroll host detached');
          return;
        }
        // 宿主是 React 等框架托管的节点时，站点 re-render 可能把我们的 inline
        // position 冲掉 → 气泡丢失定位上下文、absolute 退回相对初始包含块（位置乱飞）。
        // 幂等补回，成本一次 getComputedStyle。
        if (restoredHostPos !== null) ensurePositioningContext(hostEl);
        const m = measure();
        if (!m) return;
        const base = baselineRef.current;
        if (base === null) {
          baselineRef.current = m; // 首帧采基准
          return;
        }
        const dGap = Math.abs(m.gap - base.gap);
        if (dGap <= DRIFT_NOISE_PX) {
          strikesRef.current = 0;
          return;
        }

        const dText = Math.abs(m.textLocalY - base.textLocalY);
        if (dText > DRIFT_NOISE_PX) {
          // reflow：纠偏并重新采基准
          update();
          strikesRef.current += 1;
          baselineRef.current = measure();
          if (strikesRef.current >= DRIFT_MAX_STRIKES) {
            degrade(`reflow strikes=${strikesRef.current} gap=${dGap.toFixed(1)}px`);
          }
          return;
        }

        // 文字原地不动，气泡却相对它漂了 → 气泡没被浏览器一起搬走
        degrade(`gap drifted ${(m.gap - base.gap).toFixed(1)}px, text static`);
      };

      const tick = () => {
        raf = requestAnimationFrame(tick);
        const now = Date.now();
        if (now - lastScrollAt < SCROLL_QUIET_MS) return;
        if (now - lastVerifyAt < VERIFY_INTERVAL_MS) return;
        lastVerifyAt = now;
        verify();
      };
      const onResize = () => {
        lastVerifyAt = 0; // 尺寸变了文字会重排，立即校验一次
        update();
      };
      raf = requestAnimationFrame(tick);
      window.addEventListener('scroll', markScroll, { capture: true, passive: true });
      window.addEventListener('resize', onResize);

      return () => {
        if (raf) cancelAnimationFrame(raf);
        window.removeEventListener('scroll', markScroll, true);
        window.removeEventListener('resize', onResize);
        // 只在「宿主仍是我们注入的那个 relative」时还原：期间站点若自己改过 position
        // （re-render / 状态切换），盲目还原会把站点的样式擦掉。
        if (restoredHostPos !== null && getComputedStyle(hostEl).position === 'relative') {
          hostEl.style.position = restoredHostPos;
        }
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
    // mode 进依赖：降级（anchored → fixed）时本 effect 重跑，换成跟随模式
  }, [x, y, bottom, decision, mode, host]);

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
      // 已被容器裁剪限定在这一侧（见挂载时的裁剪适配）：再翻走按钮就会被切掉
      if (clipLockedRef.current && placementRef.current === clipLockedRef.current) return;
      const next = decidePlacement(x, y, bottom);
      if (next !== placementRef.current && flipsRef.current < MAX_FLIPS) {
        flipsRef.current += 1;
        placementRef.current = next;
        // 上下侧一变，按钮与选区的相对偏移基准也变了，必须重采基准再自检，
        // 否则会把正常的翻转误判成脱钩而降级
        baselineRef.current = null;
        strikesRef.current = 0;
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
        ...(mode === 'anchored' ? STYLE_ANCHORED : STYLE_FIXED),
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
    mode === 'anchored' ? host : document.body
  );
}
