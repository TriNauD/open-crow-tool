/**
 * 浮标定位模式判定的分支覆盖（DOM 锚定 vs fixed 回退）。
 *
 * Vitest 跑在 node 环境（无 jsdom），这里用最小 DOM 桩驱动纯逻辑分支。
 * 判定错误的后果是气泡直接飞走或与文字脱钩，属高风险分支，必须有回归。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  resolveAnchorMode,
  viewportToDocument,
} from '@/chrome-extension/src/content/floating-anchor';

type Style = Partial<CSSStyleDeclaration>;

const styles = new WeakMap<object, Style>();

interface FakeEl {
  nodeType: number;
  parentElement: FakeEl | null;
  ownerDocument: FakeDoc | null;
  scrollHeight?: number;
  clientHeight?: number;
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
  scrollHeight?: number;
  clientHeight?: number;
}): FakeEl {
  const node: FakeEl = {
    nodeType: 1,
    parentElement: opts.parent ?? null,
    ownerDocument: opts.doc ?? null,
    scrollHeight: opts.scrollHeight,
    clientHeight: opts.clientHeight,
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
function selEl(d: FakeDoc, style?: Style, parent?: FakeEl): FakeEl {
  return el({ style, doc: d, parent: parent ?? d.body });
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
    expect(decide(selEl(d), d)).toEqual({ mode: 'anchored', reason: 'ok' });
  });

  it('文本节点 startContainer 沿 parentElement 上溯', () => {
    const d = fakeDoc();
    const p = selEl(d, { position: 'fixed' });
    expect(decide(textNode(p, d), d)).toEqual({ mode: 'fixed', reason: 'ancestor-fixed' });
  });

  it('body 创建 containing block → 回退（文档坐标换算失效）', () => {
    const d = fakeDoc({ bodyStyle: { position: 'relative' } });
    expect(decide(selEl(d), d)).toEqual({ mode: 'fixed', reason: 'body-creates-cb' });
  });

  it('html 创建 containing block → 回退', () => {
    const d = fakeDoc({ htmlStyle: { transform: 'matrix(1,0,0,1,0,0)' } });
    expect(decide(selEl(d), d)).toEqual({ mode: 'fixed', reason: 'html-creates-cb' });
  });

  it('祖先 fixed / sticky → 回退（不随文档流滚动，会脱钩）', () => {
    const dFixed = fakeDoc();
    expect(decide(selEl(dFixed, { position: 'fixed' }), dFixed).reason).toBe('ancestor-fixed');
    const dSticky = fakeDoc();
    expect(decide(selEl(dSticky, { position: 'sticky' }), dSticky).reason).toBe('ancestor-sticky');
  });

  it('祖先推上独立渲染层 → 回退（层间亚像素错位会重现晃动）', () => {
    const cases: Style[] = [
      { transform: 'translateY(0)' },
      { perspective: '800px' },
      { filter: 'blur(0)' },
      { backdropFilter: 'blur(2px)' },
      { contain: 'paint' },
      { contain: 'layout' },
      { willChange: 'transform' },
    ];
    for (const style of cases) {
      const d = fakeDoc();
      expect(decide(selEl(d, style), d).reason).toBe('ancestor-own-layer');
    }
  });

  it('祖先内部可滚动容器 → 回退（文字随容器滚，气泡挂 body 不跟）', () => {
    const d = fakeDoc();
    const scroller = selEl(d, { overflowY: 'auto' }, d.body);
    Object.assign(scroller, { scrollHeight: 900, clientHeight: 400 });
    const p = selEl(d, undefined, scroller);
    expect(decide(p, d)).toEqual({ mode: 'fixed', reason: 'ancestor-scrollable' });
  });

  it('overflow:auto 但没溢出 → 仍锚定（不是真的滚动容器）', () => {
    const d = fakeDoc();
    const box = selEl(d, { overflowY: 'auto' }, d.body);
    Object.assign(box, { scrollHeight: 400, clientHeight: 400 });
    // 内嵌一层：外层不滚动，选区在内层
    const p = selEl(d, undefined, box);
    expect(decide(p, d).mode).toBe('anchored');
  });

  it('body / html 自身滚动不算内部容器 → 仍锚定', () => {
    const d = fakeDoc({
      bodyScroll: { scrollHeight: 5000, clientHeight: 800 },
      bodyStyle: { overflowY: 'auto' },
      htmlStyle: { overflowY: 'auto' },
    });
    expect(decide(selEl(d), d).mode).toBe('anchored');
  });

  it('祖先 position:relative / absolute 不排除（否则锚定几乎永不生效）', () => {
    const d = fakeDoc();
    const outer = selEl(d, { position: 'relative' }, d.body);
    const inner = selEl(d, { position: 'absolute' }, outer);
    expect(decide(inner, d).mode).toBe('anchored');
  });

  it('跨文档选区 → 回退（iframe 坐标换算会 double-offset）', () => {
    const host = fakeDoc();
    const other = fakeDoc();
    expect(decide(selEl(other), host)).toEqual({ mode: 'fixed', reason: 'cross-document' });
  });

  it('没有 body → 回退', () => {
    const d: FakeDoc = { body: null, documentElement: null, defaultView: null };
    expect(decide(selEl(fakeDoc()), d)).toEqual({ mode: 'fixed', reason: 'no-body' });
  });
});

describe('viewportToDocument', () => {
  it('视口坐标加滚动量得到文档坐标', () => {
    const d = fakeDoc({ scrollX: 0, scrollY: 240 });
    expect(viewportToDocument(d as unknown as Document, 120, 300)).toEqual({ x: 120, y: 540 });
  });

  it('无 defaultView 时退化为原值（不抛错）', () => {
    const d: FakeDoc = { body: null, documentElement: null, defaultView: null };
    expect(viewportToDocument(d as unknown as Document, 12, 34)).toEqual({ x: 12, y: 34 });
  });
});
