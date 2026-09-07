/**
 * 浮标定位模式判定的分支覆盖（DOM 锚定 vs fixed 回退）。
 *
 * Vitest 跑在 node 环境（无 jsdom），这里用最小 DOM 桩驱动纯逻辑分支。
 * 判定错误的后果是气泡直接飞走或与文字脱钩，属高风险分支，必须有回归。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  anchorCoords,
  isClippedByHost,
  resolveAnchorMode,
} from '@/chrome-extension/src/content/floating-anchor';

type Style = Partial<CSSStyleDeclaration>;

const styles = new WeakMap<object, Style>();

interface FakeEl {
  nodeType: number;
  tagName: string;
  parentElement: FakeEl | null;
  ownerDocument: FakeDoc | null;
  scrollHeight?: number;
  clientHeight?: number;
  clientWidth?: number;
  clientLeft: number;
  clientTop: number;
  scrollLeft: number;
  scrollTop: number;
  getBoundingClientRect: () => { left: number; top: number; width: number; height: number };
}

interface FakeDoc {
  body: FakeEl | null;
  documentElement: FakeEl | null;
  defaultView: { scrollX: number; scrollY: number } | null;
}

function el(opts: {
  style?: Style;
  parent?: FakeEl | null;
  doc?: FakeDoc | null;
  tag?: string;
  scrollHeight?: number;
  clientHeight?: number;
  clientWidth?: number;
  clientLeft?: number;
  clientTop?: number;
  scrollLeft?: number;
  scrollTop?: number;
  rect?: { left: number; top: number; width: number; height: number };
}): FakeEl {
  const r = opts.rect ?? { left: 0, top: 0, width: 100, height: 100 };
  const node: FakeEl = {
    nodeType: 1,
    tagName: opts.tag ?? 'div',
    parentElement: opts.parent ?? null,
    ownerDocument: opts.doc ?? null,
    scrollHeight: opts.scrollHeight,
    clientHeight: opts.clientHeight,
    clientWidth: opts.clientWidth,
    clientLeft: opts.clientLeft ?? 0,
    clientTop: opts.clientTop ?? 0,
    scrollLeft: opts.scrollLeft ?? 0,
    scrollTop: opts.scrollTop ?? 0,
    getBoundingClientRect: () => ({
      left: r.left,
      top: r.top,
      width: r.width,
      height: r.height,
      right: r.left + r.width,
      bottom: r.top + r.height,
    }),
  };
  styles.set(node, opts.style ?? {});
  return node;
}

interface DocOpts {
  bodyStyle?: Style;
  htmlStyle?: Style;
  bodyScroll?: { scrollHeight: number; clientHeight: number };
  scrollX?: number;
  scrollY?: number;
}

function fakeDoc(opts: DocOpts = {}): FakeDoc {
  const d: FakeDoc = {
    body: null,
    documentElement: null,
    defaultView: { scrollX: opts.scrollX ?? 0, scrollY: opts.scrollY ?? 0 },
  };
  const html = el({ style: opts.htmlStyle ?? {}, doc: d, parent: null });
  const body = el({
    style: opts.bodyStyle ?? {},
    doc: d,
    parent: html,
    scrollHeight: opts.bodyScroll?.scrollHeight,
    clientHeight: opts.bodyScroll?.clientHeight,
  });
  d.documentElement = html;
  d.body = body;
  return d;
}

/** 选区所在元素，默认挂在 body 下 */
function selEl(d: FakeDoc, style?: Style, parent?: FakeEl, tag?: string): FakeEl {
  return el({ style, doc: d, parent: parent ?? d.body, tag });
}

function rangeAt(startContainer: unknown): Range {
  return { startContainer } as unknown as Range;
}

/** 文本节点形态的 startContainer：nodeType=3，判定应沿 parentElement 上溯 */
function textNode(parent: FakeEl, doc: FakeDoc): Node {
  return { nodeType: 3, parentElement: parent, ownerDocument: doc } as unknown as Node;
}

function decide(startContainer: unknown, d: FakeDoc) {
  return resolveAnchorMode(rangeAt(startContainer), d as unknown as Document);
}

beforeEach(() => {
  vi.stubGlobal('getComputedStyle', (node: unknown) => styles.get(node as object) ?? {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('resolveAnchorMode', () => {
  it('纯净文档流 → 锚定（x.com 这类窗口滚动站点的目标路径）', () => {
    const d = fakeDoc();
    expect(decide(selEl(d), d)).toEqual({ mode: 'anchored', reason: 'ok', host: d.body });
  });

  it('文本节点 startContainer 沿 parentElement 上溯', () => {
    const d = fakeDoc();
    const p = selEl(d, { position: 'fixed' });
    expect(decide(textNode(p, d), d)).toEqual({
      mode: 'fixed',
      reason: 'ancestor-fixed',
      host: d.body,
    });
  });

  it('body 创建 containing block → 回退（文档坐标换算失效）', () => {
    const d = fakeDoc({ bodyStyle: { position: 'relative' } });
    expect(decide(selEl(d), d)).toEqual({
      mode: 'fixed',
      reason: 'body-creates-cb',
      host: d.body,
    });
  });

  it('html 创建 containing block → 回退', () => {
    const d = fakeDoc({ htmlStyle: { transform: 'matrix(1,0,0,1,0,0)' } });
    expect(decide(selEl(d), d)).toEqual({
      mode: 'fixed',
      reason: 'html-creates-cb',
      host: d.body,
    });
  });

  it('祖先 fixed / sticky → 回退（不随文档流滚动，会脱钩）', () => {
    const dFixed = fakeDoc();
    expect(decide(selEl(dFixed, { position: 'fixed' }), dFixed).reason).toBe('ancestor-fixed');
    const dSticky = fakeDoc();
    expect(decide(selEl(dSticky, { position: 'sticky' }), dSticky).reason).toBe(
      'ancestor-sticky'
    );
  });

  it('祖先 transform / filter / will-change / contain → 仍锚定（管不到挂在宿主的气泡）', () => {
    // 曾把这些当成回退条件，结果 x.com 这类站点 100% 回退、锚定形同虚设。
    // 气泡 absolute 挂在锚定宿主下，**不是这些祖先的后代**——它们的 containing block、
    // 裁剪、合成层效应统统影响不到气泡；文字位置由 getBoundingClientRect 给出
    // （已含变换），与静态变换兼容。动态变换的脱钩交给运行时自检降级。
    const cases: Style[] = [
      { transform: 'translateY(0)' },
      { perspective: '800px' },
      { filter: 'blur(0)' },
      { backdropFilter: 'blur(2px)' },
      { contain: 'paint' },
      { contain: 'layout' },
      { willChange: 'transform' },
      { willChange: 'opacity, transform' },
    ];
    for (const style of cases) {
      const d = fakeDoc();
      expect(decide(selEl(d, style), d)).toEqual({
        mode: 'anchored',
        reason: 'ok',
        host: d.body,
      });
    }
  });

  it('祖先内部可滚动容器 → 锚进该容器（container-anchored，ds/chatgpt 消息区的目标路径）', () => {
    const d = fakeDoc();
    const scroller = selEl(d, { overflowY: 'auto' }, d.body);
    Object.assign(scroller, { scrollHeight: 900, clientHeight: 400 });
    const p = selEl(d, undefined, scroller);
    const dec = decide(p, d);
    expect(dec.mode).toBe('anchored');
    expect(dec.host).toBe(scroller);
    expect(dec.reason).toBe('scroll-host-div');
  });

  it('overflow:auto 但没溢出 → 仍锚定（不是真的滚动容器）', () => {
    const d = fakeDoc();
    const box = selEl(d, { overflowY: 'auto' }, d.body);
    Object.assign(box, { scrollHeight: 400, clientHeight: 400 });
    // 内嵌一层：外层不滚动，选区在内层
    const p = selEl(d, undefined, box);
    expect(decide(p, d)).toEqual({ mode: 'anchored', reason: 'ok', host: d.body });
  });

  it('body / html 自身滚动不算内部容器 → 仍锚定', () => {
    const d = fakeDoc({
      bodyScroll: { scrollHeight: 5000, clientHeight: 800 },
      bodyStyle: { overflowY: 'auto' },
      htmlStyle: { overflowY: 'auto' },
    });
    expect(decide(selEl(d), d)).toEqual({ mode: 'anchored', reason: 'ok', host: d.body });
  });

  it('祖先 position:relative / absolute 不排除（否则锚定几乎永不生效）', () => {
    const d = fakeDoc();
    const outer = selEl(d, { position: 'relative' }, d.body);
    const inner = selEl(d, { position: 'absolute' }, outer);
    expect(decide(inner, d)).toEqual({ mode: 'anchored', reason: 'ok', host: d.body });
  });

  it('跨文档选区 → 回退（iframe 坐标换算会 double-offset）', () => {
    const host = fakeDoc();
    const other = fakeDoc();
    expect(decide(selEl(other), host)).toEqual({
      mode: 'fixed',
      reason: 'cross-document',
      host: host.body,
    });
  });

  it('没有 body → 回退', () => {
    const d: FakeDoc = { body: null, documentElement: null, defaultView: null };
    const dec = decide(selEl(fakeDoc()), d);
    expect(dec.mode).toBe('fixed');
    expect(dec.reason).toBe('no-body');
    expect(dec.host).toBe(d);
  });
});

describe('anchorCoords', () => {
  it('页面级（host=body）加窗口滚动量得到文档坐标', () => {
    const d = fakeDoc({ scrollX: 0, scrollY: 240 });
    const win = d.defaultView!;
    expect(anchorCoords(d.body!, 300, 120, win as unknown as Window)).toEqual({
      x: 120,
      y: 540,
    });
  });

  it('容器级（host≠body）用相对宿主内容区坐标（含容器 scrollTop）', () => {
    const d = fakeDoc();
    const host = selEl(d, {}, d.body);
    Object.assign(host, {
      scrollLeft: 0,
      scrollTop: 50,
      clientLeft: 0,
      clientTop: 0,
      getBoundingClientRect: () => ({ left: 0, top: 0, width: 100, height: 100 }),
    });
    const win = d.defaultView!;
    // host !== body → 容器公式：x=120-0-0+0=120, y=300-0-0+50=350
    expect(anchorCoords(host, 300, 120, win as unknown as Window)).toEqual({
      x: 120,
      y: 350,
    });
  });
});

describe('isClippedByHost', () => {
  /** 宿主可视区（padding box）：x 0..400，y 100..400 */
  function scroller(opts: { clientTop?: number } = {}) {
    const d = fakeDoc();
    const host = el({
      doc: d,
      parent: d.body,
      clientWidth: 400,
      clientHeight: 300,
      clientTop: opts.clientTop ?? 0,
      rect: { left: 0, top: 100, width: 400, height: 300 },
    });
    return host;
  }

  function bubbleRect(left: number, top: number, w = 100, h = 32): FakeEl {
    return el({ rect: { left, top, width: w, height: h } });
  }

  const clip = (host: FakeEl, b: FakeEl) =>
    isClippedByHost(host as unknown as Element, b as unknown as Element);

  it('气泡完整落在宿主可视区内 → 不裁', () => {
    expect(clip(scroller(), bubbleRect(50, 200))).toBe(false);
  });

  it('选区在容器第一行（气泡顶出上沿、32px 只露 2px）→ 裁', () => {
    // 气泡 70..102，宿主可视区 100..400 → 只重叠 2px，可见占比 ≈0.06
    expect(clip(scroller(), bubbleRect(50, 70))).toBe(true);
  });

  it('边缘压线几 px（大部分仍可见）→ 不裁，不为此放弃锚定', () => {
    // 气泡 94..126 → 重叠 26px，占比 ≈0.81
    expect(clip(scroller(), bubbleRect(50, 94))).toBe(false);
  });

  it('横向贴边被切（贴右缘划词）→ 裁', () => {
    // 气泡 370..470，宿主可视区 0..400 → 只重叠 30px，占比 0.3
    expect(clip(scroller(), bubbleRect(370, 200))).toBe(true);
  });

  it('完全滚到宿主可视区之外 → 裁', () => {
    expect(clip(scroller(), bubbleRect(50, 500))).toBe(true);
  });

  it('按 padding box 判定：host 有 border 时边框区也算裁剪区', () => {
    // 同一几何：无 border 重叠 20px（0.625，不裁）；clientTop=4 后重叠 16px（0.5，裁）
    expect(clip(scroller(), bubbleRect(50, 88))).toBe(false);
    expect(clip(scroller({ clientTop: 4 }), bubbleRect(50, 88))).toBe(true);
  });
});
