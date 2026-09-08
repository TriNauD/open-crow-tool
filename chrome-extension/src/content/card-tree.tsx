import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

/**
 * 追问树形索引的注册表（Context）。
 *
 * ExplainCard 是递归自渲染：父卡只知道直接 children，孙子卡的问题文本父卡拿不到。
 * 因此由根卡挂 CardTreeProvider，每张卡（含根卡自己）挂载时 register、卸载时 unregister，
 * 索引浮层从注册表读整棵树。折叠只是 display:none，不触发注销。
 *
 * 并发约定：Context value 只含**稳定身份**的方法（provider 生命周期内不变），
 * 注册表本体是不可变快照 + 订阅的外部 store——读快照必须走 useCardTreeSnapshot
 * （useSyncExternalStore），不要在渲染期直接读 ref，否则触发 react-hooks/refs。
 */

/** 注册表里的一张卡（活引用，jumpTo 用） */
export interface CardNodeRecord {
  id: string;
  question: string;
  parentId: string | null;
  depth: number;
  /** 卡片根 DOM；定位与高亮用时再取（注册发生在 commit 后，ref 已就绪） */
  getEl: () => HTMLElement | null;
  /** 解除该卡自身折叠（body 的 collapsed state） */
  expand: () => void;
  /**
   * 当前 explanation 的 getter（ref 持锁，避免 React 闭包陈旧——见 architecture W1）。
   * 异步保存（POST 循环）期间 React state 可能再变，POST 体必须读最新值而非点保存瞬间的快照。
   * 调用方应通过 useRef 持锁：每次渲染 `ref.current = explanation`，getter 闭包读 ref。
   */
  getExplanation: () => string;
}

/** 扁平节点快照（构建树形索引用，无 DOM 引用） */
export interface CardTreeNodeData {
  id: string;
  question: string;
  parentId: string | null;
  depth: number;
}

/** buildTree 的输出节点 */
export interface CardTreeTreeNode extends CardTreeNodeData {
  children: CardTreeTreeNode[];
}

export interface CardTreeStats {
  /** 注册表总数（含根卡） */
  totalCards: number;
  /** 最大嵌套深度（根卡为 0） */
  maxDepth: number;
}

/**
 * 索引出现阈值（用户确认）：出现孙卡（嵌套 ≥2 层）或追问 ≥3 条。
 * totalCards 含根卡，故「追问 ≥3」即 totalCards - 1 >= 3。
 */
export function shouldShowIndex(stats: CardTreeStats): boolean {
  return stats.maxDepth >= 2 || stats.totalCards - 1 >= 3;
}

/**
 * 扁平注册序（Map 插入序）→ 按父子关系还原树。
 * React 子组件 effect 先于父组件运行，注册顺序不保证父先子后，
 * 因此这里只按 parentId 归位，兄弟间保持各自注册顺序；孤儿（父未注册）暂不展示，
 * 父注册后的 store 通知会触发重渲染补齐。
 */
export function buildTree(nodes: CardTreeNodeData[]): CardTreeTreeNode[] {
  const byParent = new Map<string | null, CardTreeNodeData[]>();
  for (const n of nodes) {
    const list = byParent.get(n.parentId);
    if (list) list.push(n);
    else byParent.set(n.parentId, [n]);
  }
  function attach(parentKey: string | null): CardTreeTreeNode[] {
    return (byParent.get(parentKey) ?? []).map((n) => ({
      ...n,
      children: attach(n.id),
    }));
  }
  return attach(null);
}

/** 从目标沿 parentId 向上收集祖先 id 链（不含目标自身；用于跳转前逐级展开），带环防御 */
export function collectAncestors(nodes: CardTreeNodeData[], id: string): string[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const chain: string[] = [];
  const seen = new Set<string>([id]);
  let cur = byId.get(id);
  while (cur?.parentId && !seen.has(cur.parentId)) {
    seen.add(cur.parentId);
    chain.push(cur.parentId);
    cur = byId.get(cur.parentId);
  }
  return chain;
}

export function computeStats(nodes: CardTreeNodeData[]): CardTreeStats {
  let maxDepth = 0;
  for (const n of nodes) if (n.depth > maxDepth) maxDepth = n.depth;
  return { totalCards: nodes.length, maxDepth };
}

/**
 * 整树保存用的不可变快照条目（BFS 序：根在前，同层按注册序，子卡按兄弟序递归）。
 *
 * 异步保存（POST 循环）期间 React state 可能再变；拍快照的语义是「保存发起瞬间的整张表」——
 * `explanations` Map 持有每张卡的「拍下瞬间的 explanation」字符串快照，循环里用快照源。
 *
 * 父卡 explanation 用于 `parentText` 入参（API 要求 parentText 是父卡当时 explanation 的快照）；
 * 根卡的 `parentText` 为 null（根没有父）。
 */
export interface TreeSnapshotItem {
  cardId: string;
  text: string;
  explanation: string;
  parentCardId: string | null;
  depth: number;
  /** 根用一次性 uuid，整树所有 note（含孙卡）共用——便于「更新」按 clientNoteId 反查覆盖 */
  clientNoteId: string;
  parentText: string | null;
}

export interface TreeSnapshot {
  rootId: string;
  items: TreeSnapshotItem[];
  capturedAt: number;
}

/**
 * 把注册表快照拍成 BFS 序的 TreeSnapshotItem[]。
 *
 * - `nodes`：注册表扁平快照（用 `useCardTreeSnapshot()` 读取）
 * - `explanations`：cardId → 该卡拍快照瞬间的 explanation（ref 持锁读最新值）
 * - `rootExplanation`：根的 explanation（与 explanations[rootId] 等价，但解耦更清楚）
 *
 * BFS 序保证：父卡的 TreeSnapshotItem 必先于其子卡——POST 循环只需维护一个
 * `cardIdToNoteId: Map<string, string>`，按 items 顺序遍历即可保证子卡能拿到 parentNoteId。
 */
export function flattenTree(
  nodes: CardTreeNodeData[],
  explanations: Map<string, string>,
  rootExplanation: string,
  clientNoteId: string
): TreeSnapshotItem[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const rootId = findRootId(nodes);
  const items: TreeSnapshotItem[] = [];
  const seen = new Set<string>();

  // BFS 用队列；用 buildTree 把 nodes 还原成树形结构更省事（保留注册序）
  const roots = buildTree(nodes);
  const queue: CardTreeTreeNode[] = [...roots];

  while (queue.length > 0) {
    const n = queue.shift()!;
    if (seen.has(n.id)) continue;
    seen.add(n.id);

    const explanation = n.id === rootId ? rootExplanation : explanations.get(n.id) ?? '';
    const parentNode = n.parentId ? byId.get(n.parentId) : null;
    // 父的 explanation：优先从 explanations Map 读；缺则用 rootExplanation（兼容未把根入 map 的调用方）
    const parentText = parentNode
      ? parentNode.id === rootId
        ? rootExplanation
        : explanations.get(parentNode.id) ?? ''
      : null;

    items.push({
      cardId: n.id,
      text: n.question,
      explanation,
      parentCardId: n.parentId,
      depth: n.depth,
      clientNoteId,
      parentText,
    });

    // 子卡按注册序入队（buildTree 已按注册序排好兄弟）
    for (const child of n.children) queue.push(child);
  }

  return items;
}

/** 找到根卡 id（parentId 为 null 的节点；通常只有一个；多根时取第一个） */
function findRootId(nodes: CardTreeNodeData[]): string | null {
  for (const n of nodes) if (n.parentId === null) return n.id;
  return null;
}

interface CardTreeContextValue {
  register(node: CardNodeRecord): void;
  unregister(id: string): void;
  /** 注册表快照订阅（useSyncExternalStore 用）；快照引用仅在注册/注销时更换 */
  subscribe(onStoreChange: () => void): () => void;
  getSnapshot(): CardTreeNodeData[];
  jumpTo(id: string): void;
}

const CardTreeContext = createContext<CardTreeContextValue | null>(null);

/** 根卡 Provider 之外的组件拿到 null（例如理论上树未挂好时），调用方需判空 */
export function useCardTree(): CardTreeContextValue | null {
  return useContext(CardTreeContext);
}

const EMPTY_NODES: CardTreeNodeData[] = [];
const nullSubscribe = () => () => {};
const nullSnapshot = () => EMPTY_NODES;

/** 注册表扁平快照（响应式）：注册/注销时引用更换并触发重渲染 */
export function useCardTreeSnapshot(): CardTreeNodeData[] {
  const tree = useContext(CardTreeContext);
  return useSyncExternalStore(tree?.subscribe ?? nullSubscribe, tree?.getSnapshot ?? nullSnapshot);
}

const flashTimers = new WeakMap<HTMLElement, number>();

function flashEl(el: HTMLElement) {
  el.classList.remove('crow-index-flash');
  // 强制重排，连续点击同一节点也能重启动画
  void el.offsetWidth;
  el.classList.add('crow-index-flash');
  const prev = flashTimers.get(el);
  if (prev !== undefined) window.clearTimeout(prev);
  flashTimers.set(
    el,
    window.setTimeout(() => {
      el.classList.remove('crow-index-flash');
      flashTimers.delete(el);
    }, 1400)
  );
}

interface ProviderProps {
  /** 跳转前关掉根卡的「跟随滚到底」，把滚动控制权交还用户 */
  stopFollow: () => void;
  /** 根卡 body（唯一的滚动容器） */
  getScrollContainer: () => HTMLDivElement | null;
  children: ReactNode;
}

export function CardTreeProvider({ stopFollow, getScrollContainer, children }: ProviderProps) {
  const registryRef = useRef(new Map<string, CardNodeRecord>());
  const snapshotRef = useRef<CardTreeNodeData[]>([]);
  const listenersRef = useRef(new Set<() => void>());

  const notify = useCallback(() => {
    snapshotRef.current = [...registryRef.current.values()].map(
      ({ id, question, parentId, depth }) => ({ id, question, parentId, depth })
    );
    listenersRef.current.forEach((l) => l());
  }, []);

  const register = useCallback(
    (node: CardNodeRecord) => {
      registryRef.current.set(node.id, node);
      notify();
    },
    [notify]
  );

  const unregister = useCallback(
    (id: string) => {
      if (!registryRef.current.delete(id)) return;
      notify();
    },
    [notify]
  );

  const subscribe = useCallback((cb: () => void) => {
    listenersRef.current.add(cb);
    return () => {
      listenersRef.current.delete(cb);
    };
  }, []);

  const getSnapshot = useCallback(() => snapshotRef.current, []);

  const jumpTo = useCallback(
    (id: string) => {
      const registry = registryRef.current;
      const target = registry.get(id);
      if (!target) return;
      const snapshot = [...registry.values()].map(
        ({ id: nid, question: q, parentId: pid, depth: d }) => ({
          id: nid,
          question: q,
          parentId: pid,
          depth: d,
        })
      );
      // 目标及其祖先可能被折叠（display:none 时测量无效），先逐级展开
      for (const aid of collectAncestors(snapshot, id)) registry.get(aid)?.expand();
      target.expand();
      stopFollow();
      const body = getScrollContainer();
      // 等展开的 setState 提交并完成布局后再测量定位
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          const el = target.getEl();
          if (!body || !el || !el.isConnected) return;
          if (target.depth === 0) {
            body.scrollTo({ top: 0, behavior: 'smooth' });
          } else {
            const bodyRect = body.getBoundingClientRect();
            const elRect = el.getBoundingClientRect();
            const top =
              body.scrollTop + (elRect.top - bodyRect.top) - bodyRect.height / 2 + elRect.height / 2;
            body.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
          }
          flashEl(el);
        })
      );
    },
    [stopFollow, getScrollContainer]
  );

  // value 各成员均稳定引用（useCallback），provider 生命周期内身份不变——
  // 消费方（CardTreeRegistration）的 effect 不会因重渲染反复注册
  const value = useMemo(
    () => ({ register, unregister, subscribe, getSnapshot, jumpTo }),
    [register, unregister, subscribe, getSnapshot, jumpTo]
  );

  return <CardTreeContext.Provider value={value}>{children}</CardTreeContext.Provider>;
}

interface RegistrationProps {
  id: string;
  question: string;
  parentId: string | null;
  depth: number;
  getEl: () => HTMLElement | null;
  expand: () => void;
  /**
   * 整树保存用（ref 持锁）。W1：不进 effect 依赖，避免 React state 变更触发重注册风暴；
   * 只在挂载/卸载之间调一次 `tree.register(...)`，注册后取的是 ref getter（永远读最新值）。
   */
  getExplanation: () => string;
}

/** 每张卡渲染一个（渲染 null）：挂载注册、卸载注销。tree 身份稳定，effect 只跑一次 */
export function CardTreeRegistration({
  id,
  question,
  parentId,
  depth,
  getEl,
  expand,
  getExplanation,
}: RegistrationProps) {
  const tree = useCardTree();
  useEffect(() => {
    if (!tree) return;
    tree.register({ id, question, parentId, depth, getEl, expand, getExplanation });
    return () => tree.unregister(id);
    // getExplanation 是 ref-getter（持锁），W1：故意不入依赖；入则每帧重注册。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, id, question, parentId, depth, getEl, expand]);
  return null;
}
