import { describe, expect, it } from 'vitest';
import {
  buildTree,
  collectAncestors,
  computeStats,
  flattenTree,
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

describe('flattenTree（整树拍快照，BFS 序）', () => {
  function mapExpls(entries: Array<[string, string]>): Map<string, string> {
    return new Map(entries);
  }

  it('空树：返回空数组', () => {
    const items = flattenTree([], mapExpls([]), '', 'cid-root');
    expect(items).toEqual([]);
  });

  it('单层根 + 2 子：根 parentText=null，子卡 parentText=根 explanation', () => {
    const nodes = [node('root', null, 0), node('a', 'root', 1), node('b', 'root', 1)];
    const items = flattenTree(
      nodes,
      mapExpls([
        ['a', 'a-expl'],
        ['b', 'b-expl'],
      ]),
      'root-expl',
      'cid-root'
    );
    expect(items.map((i) => i.cardId)).toEqual(['root', 'a', 'b']);
    expect(items[0].depth).toBe(0);
    expect(items[0].parentCardId).toBeNull();
    expect(items[0].parentText).toBeNull();
    expect(items[0].explanation).toBe('root-expl');
    expect(items[0].clientNoteId).toBe('cid-root');
    expect(items[1].parentCardId).toBe('root');
    expect(items[1].parentText).toBe('root-expl');
    expect(items[1].depth).toBe(1);
    expect(items[2].parentCardId).toBe('root');
    expect(items[2].parentText).toBe('root-expl');
    expect(items[2].explanation).toBe('b-expl');
  });

  it('多层（根 → 子 → 孙）：BFS 序保证父子前后关系正确，孙的 parentText=子的 explanation', () => {
    const nodes = [
      node('root', null, 0),
      node('a', 'root', 1),
      node('a1', 'a', 2),
      node('b', 'root', 1),
    ];
    const items = flattenTree(
      nodes,
      mapExpls([
        ['a', 'a-expl'],
        ['a1', 'a1-expl'],
        ['b', 'b-expl'],
      ]),
      'root-expl',
      'cid-root'
    );
    expect(items.map((i) => i.cardId)).toEqual(['root', 'a', 'b', 'a1']);
    expect(items[3].cardId).toBe('a1');
    expect(items[3].parentCardId).toBe('a');
    expect(items[3].parentText).toBe('a-expl');
    expect(items[3].depth).toBe(2);
  });

  it('BFS 顺序：根先、同层按注册序', () => {
    // 子先注册的乱序也正确（buildTree 内部按 parentId 归位）
    const nodes = [
      node('b', 'root', 1),
      node('a', 'root', 1),
      node('root', null, 0),
    ];
    const items = flattenTree(
      nodes,
      mapExpls([
        ['a', 'A'],
        ['b', 'B'],
      ]),
      'ROOT',
      'cid-root'
    );
    expect(items.map((i) => i.cardId)).toEqual(['root', 'b', 'a']);
    expect(items[1].text).toBe('Q-b');
    expect(items[2].text).toBe('Q-a');
  });

  // ─── 边界用例（QA 补充）───

  it('边界1：4 层嵌套（根→子→孙→曾孙）depth 链路正确', () => {
    const nodes = [
      node('root', null, 0),
      node('a', 'root', 1),
      node('a1', 'a', 2),
      node('a1x', 'a1', 3),
    ];
    const items = flattenTree(
      nodes,
      mapExpls([
        ['a', 'a-expl'],
        ['a1', 'a1-expl'],
        ['a1x', 'a1x-expl'],
      ]),
      'root-expl',
      'cid-root'
    );
    expect(items.map((i) => i.cardId)).toEqual(['root', 'a', 'a1', 'a1x']);
    expect(items[3].depth).toBe(3);
    expect(items[3].parentCardId).toBe('a1');
    // 父 explanation 沿链路下传：曾孙的 parentText = 孙的 explanation
    expect(items[3].parentText).toBe('a1-expl');
  });

  it('边界2：同一节点重复注册（seen 防重）→ 只产出 1 条', () => {
    const nodes = [
      node('root', null, 0),
      node('a', 'root', 1),
      // 同一节点在 nodes 里重复一次（防御性：React 渲染周期里偶发重复）
      node('a', 'root', 1),
    ];
    const items = flattenTree(
      nodes,
      mapExpls([['a', 'a-expl']]),
      'root-expl',
      'cid-root'
    );
    expect(items.map((i) => i.cardId)).toEqual(['root', 'a']);
    expect(items.length).toBe(2);
  });

  it('边界3：rootExplanation 为空字符串（防御性 + 不崩）', () => {
    const nodes = [node('root', null, 0), node('a', 'root', 1)];
    const items = flattenTree(
      nodes,
      mapExpls([['a', 'a-expl']]),
      '', // 空字符串根 explanation
      'cid-root'
    );
    expect(items[0].explanation).toBe('');
    expect(items[1].parentText).toBe(''); // 子卡 parentText = ''（不是 null）
    expect(items[0].parentText).toBeNull();
  });

  it('边界4：explanations Map 缺 key → 默认空串 + 不崩', () => {
    const nodes = [
      node('root', null, 0),
      node('a', 'root', 1),
      node('b', 'root', 1),
    ];
    // Map 故意不包含 'b'（注册表丢了某张卡的最 explanation）
    const items = flattenTree(
      nodes,
      mapExpls([['a', 'a-expl']]), // 只 a 有 explanation
      'root-expl',
      'cid-root'
    );
    expect(items.length).toBe(3);
    expect(items[0].explanation).toBe('root-expl');
    expect(items[1].explanation).toBe('a-expl');
    expect(items[2].explanation).toBe(''); // 缺 key 时默认 ''
    expect(items[2].parentText).toBe('root-expl'); // 父 explanation 正常
  });

  it('边界5：整树共享 clientNoteId 一致性（每条 item 的 clientNoteId == 根 uuid）', () => {
    const nodes = [
      node('root', null, 0),
      node('a', 'root', 1),
      node('a1', 'a', 2),
      node('b', 'root', 1),
    ];
    const rootUuid = '550e8400-e29b-41d4-a716-446655440000';
    const items = flattenTree(
      nodes,
      mapExpls([
        ['a', 'A'],
        ['a1', 'A1'],
        ['b', 'B'],
      ]),
      'R',
      rootUuid
    );
    // 整树所有 item（含孙）共用根 uuid——便于「更新」按 clientNoteId 反查覆盖
    for (const item of items) {
      expect(item.clientNoteId).toBe(rootUuid);
    }
    expect(items.length).toBe(4);
  });

  it('边界6：children 为空数组（仅根，无追问）→ items 仅含根', () => {
    const nodes = [node('root', null, 0)];
    const items = flattenTree(nodes, mapExpls([]), 'only-root-expl', 'cid-root');
    expect(items).toHaveLength(1);
    expect(items[0].cardId).toBe('root');
    expect(items[0].parentCardId).toBeNull();
    expect(items[0].parentText).toBeNull();
    expect(items[0].depth).toBe(0);
    expect(items[0].text).toBe('Q-root');
  });
});
