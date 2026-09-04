/**
 * 浮动按钮避让：宿主页的划词气泡（ChatGPT 等）可能用 top-layer 弹层，
 * z-index 数值压不住，只能挑空位——检测选区上/下哪侧没被宿主浮动 UI 占据。
 */

export type Placement = 'above' | 'below';

export type RectLike = { left: number; top: number; right: number; bottom: number };

/** 按钮估算尺寸：检测用，无需精确 */
const BTN_W = 100;
const BTN_H = 32;
const BTN_GAP = 6;

export function clampButtonX(x: number): number {
  return Math.max(70, Math.min(x, window.innerWidth - 70));
}

/** placement 对应的按钮视觉矩形（估算） */
export function candidateRect(
  placement: Placement,
  x: number,
  selTop: number,
  selBottom: number
): RectLike {
  const cx = clampButtonX(x);
  const top = placement === 'above' ? Math.max(8, selTop - BTN_GAP - BTN_H) : selBottom + BTN_GAP;
  return { left: cx - BTN_W / 2, right: cx + BTN_W / 2, top, bottom: top + BTN_H };
}

/**
 * 命中元素是否属于本扩展自己的 UI。
 *
 * 两种形态都要认：
 * - Shadow 宿主 `#crow-ext-host`（卡片在里面）；
 * - 亮 DOM 浮标 `button.crow-btn[data-crow-fab]`——它是 `position: fixed`
 *   + 最大 z-index，**不被识别就会把自己当成宿主浮动 UI**，于是「上方被占→翻下方→
 *   下方被占→翻上方」每 400ms 永久横跳（普通网页上下跳动的根因）。
 */
function isOwnUi(el: Element): boolean {
  let node: Element = el;
  for (;;) {
    if (node.id === 'crow-ext-host') return true;
    if (node instanceof HTMLElement && node.dataset.crowFab !== undefined) return true;
    const root = node.getRootNode();
    if (root instanceof ShadowRoot) {
      node = root.host;
      continue;
    }
    return false;
  }
}

/**
 * 宿主浮动 UI：仅 fixed / sticky（top-layer 弹层、吸顶/吸底条等）。
 * 刻意**不认** absolute：现代页面大量绝对定位 + 高 z-index 的常规组件
 * （轮播、角标、装饰层）会被误判为「被占据」，触发无谓翻转；而我们的浮标
 * 靠 data-crow-fab 自排除，fixed/sticky 已能覆盖绝大多数宿主划词气泡。
 */
function isHostFloating(el: Element): boolean {
  const style = getComputedStyle(el);
  return style.position === 'fixed' || style.position === 'sticky';
}

function fitsViewport(r: RectLike): boolean {
  return r.left >= 0 && r.top >= 0 && r.right <= window.innerWidth && r.bottom <= window.innerHeight;
}

/** 采样矩形中心 + 四角，任一点被宿主浮动 UI 占据即视为冲突 */
export function isRectCoveredByHostUI(rect: RectLike): boolean {
  const pts: Array<[number, number]> = [
    [(rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2],
    [rect.left + 2, rect.top + 2],
    [rect.right - 2, rect.top + 2],
    [rect.left + 2, rect.bottom - 2],
    [rect.right - 2, rect.bottom - 2],
  ];
  for (const [px, py] of pts) {
    if (px < 0 || py < 0 || px > window.innerWidth || py > window.innerHeight) continue;
    const hits = document.elementsFromPoint(px, py);
    for (const el of hits.slice(0, 5)) {
      if (isOwnUi(el)) continue;
      if (isHostFloating(el)) return true;
    }
  }
  return false;
}

/** 优先上方；上方被占（或放不下）翻下方；两侧都冲突保持上方（不劣于旧行为） */
export function decidePlacement(x: number, selTop: number, selBottom: number): Placement {
  const above = candidateRect('above', x, selTop, selBottom);
  if (fitsViewport(above) && !isRectCoveredByHostUI(above)) return 'above';
  const below = candidateRect('below', x, selTop, selBottom);
  if (fitsViewport(below) && !isRectCoveredByHostUI(below)) return 'below';
  return 'above';
}
