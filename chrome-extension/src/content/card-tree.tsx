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
}

/** 每张卡渲染一个（渲染 null）：挂载注册、卸载注销。tree 身份稳定，effect 只跑一次 */
export function CardTreeRegistration({ id, question, parentId, depth, getEl, expand }: RegistrationProps) {
  const tree = useCardTree();
  useEffect(() => {
    if (!tree) return;
    tree.register({ id, question, parentId, depth, getEl, expand });
    return () => tree.unregister(id);
  }, [tree, id, question, parentId, depth, getEl, expand]);
  return null;
}
