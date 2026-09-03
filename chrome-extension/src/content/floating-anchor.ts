/**
 * 浮标定位模式判定 + 坐标换算（DOM 锚定根治滚动晃动）。
 *
 * ## 背景：为什么需要 DOM 锚定
 *
 * 滚动时气泡相对文字「轻微上下晃」的根因，是**合成器（GPU）滚动与主线程读取坐标
 * 的相位差**：超重 SPA / AI 对话站的滚动由合成器线程驱动，而主线程
 * `getBoundingClientRect()` 读到的坐标滞后于视觉滚动位置。于是无论 rAF 多勤、
 * transform 多平滑，「每帧读坐标 → 写 DOM」都必然把**滞后的坐标**盖到**已经滚到位**
 * 的内容上，气泡相对文字慢半帧 = 晃动。这是 JS 跟随方案的固有天花板，
 * 靠调 rAF 时序 / scroll 同步 / will-change 都跨不过去（will-change 反而更糟，
 * 见下）。
 *
 * ## 根治：把气泡交给浏览器一起滚
 *
 * DOM 锚定——气泡以 `position: absolute` 挂进**选区所在的滚动容器**（或页面级时挂
 * `body`），用局部/文档坐标定位。滚动时气泡就是内容的一部分，浏览器在合成滚动时
 * 把它和文字一起搬走，JS 完全不参与 → 相位差归零。
 *
 * 关键在**锚定宿主的选择**：
 * - 选区内含「内部可滚动容器」（AI 对话站的消息区 `overflow-y:auto`）→ 气泡挂进
 *   那个容器，随容器一起滚。这正是 ds / chatgpt 这类站点之前失败的原因：旧逻辑把
 *   「祖先有内部滚动容器」当成拒绝条件直接回退 `fixed`，而 `fixed` 在合成器滚动
 *   站点仍有相位差。
 * - 选区就在页面文档流里（普通网页 / x.com）→ 宿主退化为 `body`，即页面级锚定，
 *   x.com 已验证有效。
 *
 * ## 启用条件（任一不满足即回退 fixed）
 *
 * 1. `body` / `html` 都不能创建 containing block，否则 absolute 的坐标基准错乱。
 * 2. 选区祖先链上不能有 `fixed` / `sticky`——它们不随文档流滚动，文字与挂在容器
 *    里的气泡会脱钩。
 * 3. 选区必须与浮标同文档——跨 frame 取到的 range 坐标属于 iframe 文档，
 *    换算会 double-offset。
 *
 * ## 关键：祖先的 transform / filter / will-change **不阻止**锚定
 *
 * 曾经把「祖先创建独立渲染层」也列为回退条件，结果 x.com 这类站点 100% 回退、
 * DOM 锚定形同虚设。那是把旧版 `will-change` 的教训过度外推了——两者不是一回事：
 *
 * - **旧版**：`will-change` 加在**气泡自己**身上，气泡被推上独立合成层，
 *   而它又是 `fixed` + 每帧被 JS 写坐标。三个条件叠加才制造出层间亚像素错位。
 * - **现在**：气泡 `absolute` 挂在锚定宿主下，**不是那些祖先的后代**——它们的
 *   containing block 效应、裁剪效应、层效应统统管不到气泡。而文字的视觉位置
 *   由 `getBoundingClientRect()` 给出（已包含祖先变换的结果），加上滚动量换算
 *   成宿主局部/文档坐标后，与**静态**变换完全兼容。
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
  /**
   * 锚定宿主：anchored 模式下气泡要挂进去的元素。
   * - 选区在「内部滚动容器」里（AI 对话站的消息区）→ 宿主就是那个容器，
   *   气泡成为容器内容的一部分，随容器一起滚，零相位差。
   * - 选区在页面文档流里（普通网页 / x.com）→ 宿主是 body，退化为页面级锚定。
   * fixed 模式下此字段无意义（气泡永远挂 body + 视口坐标跟随）。
   */
  host: Element;
}

/**
 * 是否创建 containing block（对 absolute 定位元素）。
 * 仅用于判定 `body` / `html`——它们的 CB 属性决定坐标换算是否成立。
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

/** 固定 / 吸附定位：不随文档流滚动，文字与挂宿主的气泡会脱钩 */
function isPinned(cs: CSSStyleDeclaration): boolean {
  return cs.position === 'fixed' || cs.position === 'sticky';
}

/** 实际可纵向滚动的内部容器（文字随它滚，宿主气泡也要随它滚） */
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

function hostTag(el: Element): string {
  return (el.tagName || 'unknown').toLowerCase();
}

/**
 * 判定浮标该用哪种定位模式、锚进哪个宿主。
 *
 * @param range 选区快照（只读 startContainer，不改动）
 * @param doc 浮标要挂载的文档（必须是气泡 portal 进去的那个 document）
 */
export function resolveAnchorMode(range: Range, doc: Document): AnchorDecision {
  const body = doc.body;
  const root = doc.documentElement;
  if (!body || !root) return { mode: 'fixed', reason: 'no-body', host: body ?? root ?? doc };

  // 同文档要求：跨 frame 的 range 坐标属于 iframe 文档，换算会 double-offset
  const rangeDoc = range?.startContainer?.ownerDocument;
  if (rangeDoc && rangeDoc !== doc) return { mode: 'fixed', reason: 'cross-document', host: body };

  // 锚定要求 containing block = 初始包含块，否则坐标换算失效
  if (createsContainingBlock(getComputedStyle(body))) {
    return { mode: 'fixed', reason: 'body-creates-cb', host: body };
  }
  if (createsContainingBlock(getComputedStyle(root))) {
    return { mode: 'fixed', reason: 'html-creates-cb', host: body };
  }

  // 选锚定宿主：向上找第一个非 fixed/sticky 的「内部可滚动容器」。
  // 找不到（选区本就在页面文档流）就退化为 body —— 即页面级锚定，x.com 已验证有效。
  let host: Element = body;
  let node = startElement(range);
  let hops = 0;
  // 上限兜底：结构异常（环 / 超深嵌套）时不至于卡死主线程
  while (node && hops < 200) {
    hops += 1;
    const cs = getComputedStyle(node);
    // fixed / sticky 不随文档流滚动，锚进去会脱钩 → 整条回退 fixed
    if (isPinned(cs)) return { mode: 'fixed', reason: `ancestor-${cs.position}`, host: body };
    // body / html 自己就是页面滚动容器：不作为「内部容器」候选（否则会自指），
    // 气泡挂 body 即可随整页滚。真正要抓的是「选区与 body 之间的内部滚动 div」。
    if (node !== body && node !== root && isScrollableBox(node, cs)) {
      host = node;
      break;
    }
    if (node === root) break;
    node = node.parentElement;
  }

  const reason = host === body ? 'ok' : `scroll-host-${hostTag(host)}`;
  return { mode: 'anchored', reason, host };
}

// —— 运行时自检阈值：锚定模式下「气泡与文字的相对偏移」不该变；变了要查清是谁变的 ——

/** 小于此值视为浮点噪声 / 四舍五入，不处理 */
export const DRIFT_NOISE_PX = 1.5;
/** 静止期连续纠偏这么多次仍对不上 → 认输降级（防内容持续跳动时空转） */
export const DRIFT_MAX_STRIKES = 3;

/**
 * 视口坐标 → 锚定模式下的落位坐标。
 *
 * - **页面级（host === body）**：气泡实际相对初始包含块（html / 视口），
 *   用「视口坐标 + 窗口滚动量」得到文档坐标。
 * - **容器级（host 是内部滚动容器）**：气泡 absolute 挂进 host 内部、相对 host
 *   的定位上下文，用「相对 host 内容区原点」的局部坐标：文字视口坐标减去 host
 *   内容区在视口的偏移、加上 host 内部 scrollTop/Left（内容原点在视口上方时为负）。
 *
 * 仅在 `mode === 'anchored'` 时使用；fixed 模式直接用视口坐标（相对视口），不要调此函数。
 * `win` 必须传 `host.ownerDocument.defaultView`（可能是 iframe 的 window）。
 */
export function anchorCoords(
  host: Element,
  vTop: number,
  vLeft: number,
  win: Window
): { x: number; y: number } {
  const box = host as HTMLElement;
  // 页面级：气泡相对初始包含块，需叠加窗口滚动量
  if (host === (host.ownerDocument?.body ?? null)) {
    return { x: vLeft + win.scrollX, y: vTop + win.scrollY };
  }
  // 容器级：相对 host 内容区原点
  const hr = box.getBoundingClientRect();
  return {
    x: vLeft - hr.left - box.clientLeft + box.scrollLeft,
    y: vTop - hr.top - box.clientTop + box.scrollTop,
  };
}
