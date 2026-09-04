import { describe, expect, it } from 'vitest';
import {
  buildTree,
  collectAncestors,
  computeStats,
  shouldShowIndex,
  type CardTreeNodeData,
} from '@/chrome-extension/src/content/card-tree';

function node(id: string, parentId: string | null, depth: number): CardTreeNodeData {
  return { id, question: `Q-${id}`, parentId, depth };
}

describe('shouldShowIndex（阈值：孙卡或追问≥3）', () => {
  it('仅根卡 / 两张追问（单层）不出现', () => {
    expect(shouldShowIndex({ totalCards: 1, maxDepth: 0 })).toBe(false);
    expect(shouldShowIndex({ totalCards: 3, maxDepth: 1 })).toBe(false);
  });

  it('追问 3 张（totalCards=4）出现', () => {
    expect(shouldShowIndex({ totalCards: 4, maxDepth: 1 })).toBe(true);
  });

  it('出现孙卡（嵌套 2 层）即出现', () => {
    expect(shouldShowIndex({ totalCards: 3, maxDepth: 2 })).toBe(true);
    expect(shouldShowIndex({ totalCards: 2, maxDepth: 2 })).toBe(true);
  });
});

describe('buildTree（按 parentId 归位，兄弟保持注册顺序）', () => {
  it('常规父先子后的注册序', () => {
    const tree = buildTree([
      node('root', null, 0),
      node('a', 'root', 1),
      node('a1', 'a', 2),
      node('b', 'root', 1),
    ]);
    expect(tree.map((n) => n.id)).toEqual(['root']);
    expect(tree[0].children.map((n) => n.id)).toEqual(['a', 'b']);
    expect(tree[0].children[0].children.map((n) => n.id)).toEqual(['a1']);
    expect(tree[0].children[1].children).toEqual([]);
  });

  it('子先父后的注册序（React 子 effect 先跑）同样归位', () => {
    const tree = buildTree([
      node('a', 'root', 1),
      node('root', null, 0),
      node('a1', 'a', 2),
    ]);
    expect(tree.map((n) => n.id)).toEqual(['root']);
    expect(tree[0].children.map((n) => n.id)).toEqual(['a']);
    expect(tree[0].children[0].children.map((n) => n.id)).toEqual(['a1']);
  });

  it('孤儿（父未注册）不挂在根下', () => {
    const tree = buildTree([node('root', null, 0), node('x', 'ghost', 1)]);
    expect(tree.map((n) => n.id)).toEqual(['root']);
    expect(tree[0].children).toEqual([]);
  });
});

describe('collectAncestors（跳转前展开用）', () => {
  const nodes = [node('root', null, 0), node('a', 'root', 1), node('a1', 'a', 2), node('b', 'root', 1)];

  it('孙子卡的祖先链为 父→根（不含自身）', () => {
    expect(collectAncestors(nodes, 'a1')).toEqual(['a', 'root']);
  });

  it('子卡 / 根卡', () => {
    expect(collectAncestors(nodes, 'b')).toEqual(['root']);
    expect(collectAncestors(nodes, 'root')).toEqual([]);
  });

  it('异常数据成环时终止不挂死', () => {
    const cycle: CardTreeNodeData[] = [
      node('x', 'y', 1),
      node('y', 'x', 1),
    ];
    expect(collectAncestors(cycle, 'x')).toEqual(['y']);
  });
});

describe('computeStats', () => {
  it('总数含根卡，深度取最大', () => {
    expect(computeStats([node('root', null, 0), node('a', 'root', 1), node('a1', 'a', 2)])).toEqual({
      totalCards: 3,
      maxDepth: 2,
    });
  });
});
