/**
 * 浮标定位模式判定 + 坐标换算（DOM 锚定根治滚动晃动）。
 *
 * ## 背景：为什么需要 DOM 锚定
 *
 * 滚动时气泡相对文字「轻微上下晃」的根因，是**合成器（GPU）滚动与主线程读取坐标
 * 的相位差**：x.com 这类超重 SPA 的滚动由合成器线程驱动，而主线程
 * `getBoundingClientRect()` 读到的坐标滞后于视觉滚动位置。于是无论 rAF 多勤、
 * transform 多平滑，「每帧读坐标 → 写 DOM」都必然把**滞后的坐标**盖到**已经滚到位**
 * 的内容上，气泡相对文字慢半帧 = 晃动。这是 JS 跟随方案的固有天花板，
 * 靠调 rAF 时序 / scroll 同步 / will-change 都跨不过去（will-change 反而更糟，
 * 见下）。
 *
 * ## 根治：把气泡交给浏览器一起滚
 *
 * DOM 锚定——气泡以 `position: absolute` 挂进 `document.body`，用**文档坐标**定位。
 * 滚动时气泡就是文档内容的一部分，浏览器在合成滚动时把它和文字一起搬走，
 * JS 完全不参与 → 相位差归零。代价是：只有在「文档结构纯净」时坐标才成立，
 * 否则必须回退 `fixed` + rAF 跟随。
 *
 * ## 启用条件（任一不满足即回退）
 *
 * 1. `body` / `html` 都不能创建 containing block，否则 absolute 的坐标基准
 *    不是文档原点，文档坐标换算失效。
 * 2. 选区祖先链上不能有 `fixed` / `sticky`——它们不随文档流滚动，文字与
 *    挂在 body 的气泡会脱钩。
 * 3. 选区祖先链上不能有**内部可滚动容器**——文字随容器滚，气泡挂在 body 不跟。
 *    （`body` / `html` 自身是页面滚动容器，不在此列：气泡是它们的子元素，
 *    页面滚动时气泡本就跟着走。）
 * 4. 选区必须与浮标同文档——跨 frame 取到的 range 坐标属于 iframe 文档，
 *    换算成顶层文档坐标会 double-offset。
 *
 * ## 关键：祖先的 transform / filter / will-change **不阻止**锚定
 *
 * 曾经把「祖先创建独立渲染层」也列为回退条件，结果 x.com 这类站点 100% 回退、
 * DOM 锚定形同虚设。那是把旧版 `will-change` 的教训过度外推了——两者不是一回事：
 *
 * - **旧版**：`will-change` 加在**气泡自己**身上，气泡被推上独立合成层，
 *   而它又是 `fixed` + 每帧被 JS 写坐标。三个条件叠加才制造出层间亚像素错位。
 * - **现在**：气泡 `absolute` 挂在 body 下，**不是那些祖先的后代**——它们的
 *   containing block 效应、裁剪效应、层效应统统管不到气泡。而文字的视觉位置
 *   由 `getBoundingClientRect()` 给出（已包含祖先变换的结果），加上滚动量换算
 *   成文档坐标后，与**静态**变换完全兼容。
 *
 * 所以真正需要防的只剩一种：祖先的变换是**滚动中动态变化**的（虚拟滚动、
 * transform 模拟滚动），此时文字随变换移动而气泡不动 → 脱钩。这个在挂载时
 * 无法区分静态与动态，交给运行时自检：比较「气泡与文字的相对偏移」是否还等于
 * 挂载时的基准值，持续对不上就自动降级到 `fixed` 模式（见 `FloatingButton`）。
 */

export type AnchorMode = 'anchored' | 'fixed';

export interface AnchorDecision {
  mode: AnchorMode;
  /** 判定原因：真机排查用（直接打进 console），不是调试残留 */
  reason: string;
}

/**
 * 是否创建 containing block（对 absolute 定位元素）。
 * 仅用于判定 `body` / `html`——它们的 CB 属性决定文档坐标换算是否成立。
 */
function createsContainingBlock(cs: CSSStyleDeclaration): boolean {
  if (cs.position && cs.position !== 'static') return true;
  if (cs.transform && cs.transform !== 'none') return true;
  if (cs.perspective && cs.perspective !== 'none') return true;
  if (cs.filter && cs.filter !== 'none') return true;
  if (cs.backdropFilter && cs.backdropFilter !== 'none') return true;
  if (cs.contain && /(paint|layout|strict|content)/.test(cs.contain)) return true;
  if (cs.willChange && /(transform|perspective|filter)/.test(cs.willChange)) return true;
  return false;
}

/** 固定 / 吸附定位：不随文档流滚动，文字与挂 body 的气泡会脱钩 */
function isPinned(cs: CSSStyleDeclaration): boolean {
  return cs.position === 'fixed' || cs.position === 'sticky';
}

/** 实际可纵向滚动的内部容器（文字随它滚，body 不动） */
function isScrollableBox(el: Element, cs: CSSStyleDeclaration): boolean {
  const box = el as HTMLElement;
  const sh = box.scrollHeight;
  const ch = box.clientHeight;
  if (typeof sh !== 'number' || typeof ch !== 'number') return false;
  if (sh <= ch + 1) return false;
  return /(auto|scroll)/.test(cs.overflowY || '');
}

/** 选区 Range 所属元素（文本节点取父元素） */
function startElement(range: Range): Element | null {
  const n = range.startContainer;
  if (!n) return null;
  return n.nodeType === 1 ? (n as Element) : n.parentElement;
}

/**
 * 判定浮标该用哪种定位模式。
 *
 * @param range 选区快照（只读 startContainer，不改动）
 * @param doc 浮标要挂载的文档（必须是气泡 portal 进去的那个 document）
 */
export function resolveAnchorMode(range: Range, doc: Document): AnchorDecision {
  const body = doc.body;
  const root = doc.documentElement;
  if (!body || !root) return { mode: 'fixed', reason: 'no-body' };

  // 同文档要求：跨 frame 的 range 坐标属于 iframe 文档，换算会 double-offset
  const rangeDoc = range?.startContainer?.ownerDocument;
  if (rangeDoc && rangeDoc !== doc) return { mode: 'fixed', reason: 'cross-document' };

  // 锚定要求 containing block = 初始包含块，否则文档坐标不成立
  if (createsContainingBlock(getComputedStyle(body))) {
    return { mode: 'fixed', reason: 'body-creates-cb' };
  }
  if (createsContainingBlock(getComputedStyle(root))) {
    return { mode: 'fixed', reason: 'html-creates-cb' };
  }

  let node = startElement(range);
  let hops = 0;
  // 上限兜底：结构异常（环 / 超深嵌套）时不至于卡死主线程
  while (node && hops < 200) {
    hops += 1;
    const cs = getComputedStyle(node);
    if (isPinned(cs)) return { mode: 'fixed', reason: `ancestor-${cs.position}` };
    // 注意：**不检查** transform / filter / will-change / contain。气泡 absolute
    // 挂在 body 下，不是这些祖先的后代，它们的坐标系与层效应管不到气泡；
    // 文字视觉位置由 getBoundingClientRect 给出（已含变换），与静态变换兼容。
    // 动态变换（虚拟滚动）造成的脱钩交给运行时自检降级，不在此处一刀切拒绝。
    // body / html 是页面滚动容器本身：气泡是它们的子元素，页面滚动时本就跟着走
    if (node !== body && node !== root && isScrollableBox(node, cs)) {
      return { mode: 'fixed', reason: 'ancestor-scrollable' };
    }
    if (node === root) break;
    node = node.parentElement;
  }

  return { mode: 'anchored', reason: 'ok' };
}

// —— 运行时自检阈值：锚定模式下「气泡与文字的相对偏移」不该变；变了要查清是谁变的 ——

/** 小于此值视为浮点噪声 / 四舍五入，不处理 */
export const DRIFT_NOISE_PX = 1.5;
/** 静止期连续纠偏这么多次仍对不上 → 认输降级（防内容持续跳动时空转） */
export const DRIFT_MAX_STRIKES = 3;

/**
 * 视口坐标 → 锚定模式下的文档坐标。
 *
 * **仅在 `resolveAnchorMode` 返回 `anchored` 时可用**：此时 containing block 是
 * 初始包含块，其原点即文档原点，视口坐标加上滚动量就是 absolute 的 left/top。
 * 在 fixed 模式下调用会得到错误结果（fixed 相对视口，不该加滚动量）。
 */
export function viewportToDocument(
  doc: Document,
  vx: number,
  vy: number
): { x: number; y: number } {
  const win = doc.defaultView;
  const sx = win ? win.scrollX : 0;
  const sy = win ? win.scrollY : 0;
  return { x: vx + sx, y: vy + sy };
}
