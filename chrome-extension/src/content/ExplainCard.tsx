import { useEffect, useRef, useState, useCallback, useMemo, type ReactNode, type RefObject } from 'react';
import type { CrowAuth } from '../lib/crow-session';
import { ensureFreshAuth, loadCrowAuth } from '../lib/crow-session';
import { useStreamExplain } from './useStreamExplain';
import { normalizeNoteInput } from './normalize-note-input';
import CrowLoginForm from '../components/CrowLoginForm';
import {
  buildTree,
  CardTreeProvider,
  CardTreeRegistration,
  computeStats,
  flattenTree,
  shouldShowIndex,
  useCardTree,
  useCardTreeSnapshot,
  type TreeSnapshotItem,
} from './card-tree';
import type { CardTreeTreeNode } from './card-tree';

/** 一轮历史：问题 + 当时的回答 */
interface FollowUpTurn {
  question: string;
  explanation: string;
}

/**
 * 追问整树保存用的上下文，由根卡创建，子卡通过 props 读取 + 写入。
 * 整棵追问树所有 note 共用一个 rootClientNoteId（DB 唯一索引宽容多 note 同 clientNoteId）；
 * 子卡「只存本条」独立 UUID 不进这棵树。
 */
export interface ParentSaveContext {
  /** 根一次性 UUID，整树所有 note 共用——便于「更新」按 clientNoteId 反查覆盖 */
  rootClientNoteId: string;
  /** 子卡在整树循环里的保存状态：'saved' / 'failed' / 'parent-failed' */
  childStatuses: Record<string, ChildTreeSaveStatus>;
  /** 触发整树循环里某条子卡单独重试（不重整树）；仅根用 */
  onRetryChild: (cardId: string) => void;
}

export type ChildTreeSaveStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; noteId: string }
  | { kind: 'failed'; error: string };

interface Props {
  text: string;
  surroundingText?: string;
  anchorX: number;
  anchorY: number;
  config: CrowAuth;
  isAuthenticated?: boolean;
  onConnectPlugin?: () => void;
  onSessionUpdate?: (next: CrowAuth) => void;
  onClose: () => void;
  /** 子卡片点击 × 时由父卡调用，从父卡 children 中移除自己 */
  onRemove?: (id: string) => void;
  history?: FollowUpTurn[];
  depth?: number;
  /** 本卡在追问树中的 id（父卡下发；根卡自行生成） */
  cardId?: string;
  /** 父卡 id；根卡为空 */
  parentId?: string | null;
  /** 追问整树保存的上下文（仅根卡 → 子卡传递）。根卡为 undefined。 */
  parentSaveContext?: ParentSaveContext;
  /** 根→子：子卡 mount 时把「自己的 explanation 持锁 getter」注册给根——根拍快照用。 */
  registerExplanationGetter?: (cardId: string, getter: () => string) => void;
  unregisterExplanationGetter?: (cardId: string) => void;
}

type DuplicateHit = {
  id: string;
  inputText: string;
  explanation: string;
};

/**
 * 「已存」状态的总览：
 * - 'unsaved'：尚未保存 / 失败清空态
 * - 'saving'：正在循环 POST
 * - 'saved'：整树全部成功
 * - 'partial'：整树部分成功，footer 提示 + 失败子卡标红
 */
type TreeSaveStatus = 'unsaved' | 'saving' | 'saved' | 'partial';

const CARD_W = 360;
const CARD_H = 320;
const CARD_MARGIN = 12;
/** 追问索引浮层宽度（左缘浮层，不挤压卡片） */
const TREE_PANEL_W = 224;

export default function ExplainCard({
  text,
  surroundingText,
  anchorX,
  anchorY,
  config,
  isAuthenticated = true,
  onConnectPlugin,
  onSessionUpdate,
  onClose,
  onRemove,
  history,
  depth = 0,
  cardId,
  parentId,
  parentSaveContext,
  registerExplanationGetter,
  unregisterExplanationGetter,
}: Props) {
  // ── 基础状态 ──
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<'generic' | 'expired' | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [duplicate, setDuplicate] = useState<DuplicateHit | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [followUpText, setFollowUpText] = useState('');
  const [children, setChildren] = useState<{ id: string; text: string }[]>([]);
  const cardRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const { text: explanation, isLoading, error, isDone, explain, quotaOut, tag } = useStreamExplain(
    config.apiBaseUrl
  );

  // ── 钉住 / 拖拽状态 ──
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x = anchorX - CARD_W / 2;
    x = Math.max(CARD_MARGIN, Math.min(x, vw - CARD_W - CARD_MARGIN));
    let y = anchorY - CARD_H - 10;
    if (y < CARD_MARGIN) y = anchorY + 24;
    y = Math.max(CARD_MARGIN, Math.min(y, vh - CARD_H - CARD_MARGIN));
    return { x, y };
  });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);

  // ── 折叠状态：仅手动切换（出子卡片不自动收起，改为自动滚动到最新回答） ──
  const [collapsed, setCollapsed] = useState(false);

  // ── 出子卡片后自动跟随滚动到底部；用户向上滚动即停止跟随 ──
  const followBottomRef = useRef(false);
  const childNodesRef = useRef(new Map<string, HTMLDivElement>());

  // ── 追问树形索引：本卡在注册表中的身份与活引用 ──
  const [selfId] = useState(() => cardId ?? crypto.randomUUID());
  const indexLayerRef = useRef<HTMLDivElement | null>(null);
  const getSelfEl = useCallback(() => cardRef.current, []);
  const expandSelf = useCallback(() => setCollapsed(false), []);
  // 仅根卡会把这两个传给 CardTreeProvider（jumpTo 用）
  const stopFollow = useCallback(() => { followBottomRef.current = false; }, []);
  const getScrollContainer = useCallback(() => bodyRef.current, []);

  // ── 滚动箭头状态 ──
  const [canScroll, setCanScroll] = useState(false);
  const [scrollAtTop, setScrollAtTop] = useState(true);
  const [scrollAtBottom, setScrollAtBottom] = useState(false);

  // ═══════════════════════════════════════════
  //  追问整树保存（W1：ref 持锁避免 React state 闭包陈旧）
  //  - explanationRef 在每次渲染同步当前 explanation，flattenTree 通过 getter 读最新值；
  //  - 注册表 effect 不依赖 getExplanation，避免每帧重注册。
  //  - ref 同步放在 useEffect（不在渲染期直接写 ref——eslint react-hooks/refs）
  // ═══════════════════════════════════════════
  const explanationRef = useRef<string>(explanation ?? '');
  useEffect(() => {
    explanationRef.current = explanation ?? '';
  }, [explanation]);

  // 把自己的 ref 暴露给父（仅子卡 depth>0 且有 register props）
  useEffect(() => {
    if (depth > 0 && registerExplanationGetter && unregisterExplanationGetter) {
      registerExplanationGetter(selfId, () => explanationRef.current);
      return () => unregisterExplanationGetter(selfId);
    }
  }, [depth, selfId, registerExplanationGetter, unregisterExplanationGetter]);

  // ── 整树 clientNoteId：根一次性生成，整树共用（rootClientNoteId）；子卡单存走自己独立 UUID ──
  const [rootClientNoteId] = useState(() => crypto.randomUUID());

  // ── 整树保存循环的状态 ──
  const [treeStatus, setTreeStatus] = useState<TreeSaveStatus>('unsaved');
  const [treeSaveStats, setTreeSaveStats] = useState<{ savedCount: number; totalCount: number }>({
    savedCount: 0,
    totalCount: 0,
  });
  /** 整树循环里每张子卡的保存状态（按 cardId 索引；根自己不在表里） */
  const [childStatuses, setChildStatuses] = useState<Record<string, ChildTreeSaveStatus>>({});

  // ── 子卡 explanation getter 注册表（仅根用）：map<cardId, ()=>string> ──
  const childExplanationGettersRef = useRef<Map<string, () => string>>(new Map());
  const registerChildExplanationGetter = useCallback((cardId: string, getter: () => string) => {
    childExplanationGettersRef.current.set(cardId, getter);
  }, []);
  const unregisterChildExplanationGetter = useCallback((cardId: string) => {
    childExplanationGettersRef.current.delete(cardId);
  }, []);

  /** Provider 内的注册表扁平快照——根整树保存的 snapshot 来源 */
  const liveNodes = useCardTreeSnapshot();

  // ── 子卡视角的 parentSaveContext：把根的整树状态透给子卡 footer ──
  // 根自创建并下发给每个子 ExplainCard；子卡的「整树」按钮不会触发（depth>0 走单存）。
  const parentSaveContextValue = useMemo<ParentSaveContext | undefined>(() => {
    if (depth !== 0) return undefined; // 子卡不创建 context（它读父下发的）
    return {
      rootClientNoteId,
      childStatuses,
      onRetryChild: (cardId: string) => {
        setChildStatuses((prev) => {
          const cur = prev[cardId];
          if (!cur || cur.kind !== 'failed') return prev;
          return { ...prev, [cardId]: { kind: 'saving' } };
        });
      },
    };
  }, [depth, rootClientNoteId, childStatuses]);

  const notebookUrl = `${config.apiBaseUrl.replace(/\/+$/, '')}/notebook`;

  // ── 对话记录组装 ──
  const transcriptContext = history?.length
    ? history
        .map(
          (t, i) =>
            `第 ${i + 1} 轮问答：\n问：「${t.question}」\n答：「${t.explanation}」`
        )
        .join('\n\n')
    : undefined;

  const hasExplainReady = Boolean(explanation?.length) && isDone && !error;
  const showSaveFooter =
    hasExplainReady || Boolean(saveError) || isSaving || Boolean(duplicate);

  // ═══════════════════════════════════════════
  //  效果：发起解释
  // ═══════════════════════════════════════════
  useEffect(() => {
    if (transcriptContext) {
      explain(text, { context: transcriptContext });
    } else if (surroundingText) {
      explain(text, { surroundingText });
    } else {
      explain(text);
    }
  }, [text, transcriptContext, surroundingText, explain]);

  // ═══════════════════════════════════════════
  //  效果：点击外部关闭（钉住时不关闭）。
  //  索引层（把手/浮层）渲染在卡片元素之外，点击它不算外部。
  // ═══════════════════════════════════════════
  useEffect(() => {
    if (pinned) return;
    function onMouseDown(e: MouseEvent) {
      const path = e.composedPath();
      const insideCard = cardRef.current ? path.includes(cardRef.current) : false;
      const insideIndex = indexLayerRef.current ? path.includes(indexLayerRef.current) : false;
      if (!insideCard && !insideIndex) {
        onClose();
      }
    }
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', onMouseDown);
    }, 150);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', onMouseDown);
    };
  }, [onClose, pinned]);

  // ═══════════════════════════════════════════
  //  效果：检测 body 是否可滚动 + 滚动位置
  // ═══════════════════════════════════════════
  const checkScroll = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    const overflow = el.scrollHeight > el.clientHeight + 2;
    setCanScroll(overflow);
    setScrollAtTop(el.scrollTop <= 2);
    setScrollAtBottom(el.scrollTop + el.clientHeight >= el.scrollHeight - 2);
  }, []);

  useEffect(() => {
    checkScroll();
    const el = bodyRef.current;
    if (!el) return;
    const ro = new ResizeObserver(checkScroll);
    ro.observe(el);
    el.addEventListener('scroll', checkScroll, { passive: true });
    // 向上滚 = 用户想停在上面，关掉底部跟随
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY < 0) followBottomRef.current = false;
    };
    el.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener('scroll', checkScroll);
      el.removeEventListener('wheel', onWheel);
    };
  }, [checkScroll, explanation, children.length]);

  // ═══════════════════════════════════════════
  //  拖拽逻辑
  // ═══════════════════════════════════════════
  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      if (!pinned) return;
      e.preventDefault();
      dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };

      function onMove(ev: MouseEvent) {
        if (!dragRef.current) return;
        const dx = ev.clientX - dragRef.current.startX;
        const dy = ev.clientY - dragRef.current.startY;
        const newX = Math.max(CARD_MARGIN, Math.min(dragRef.current.origX + dx, window.innerWidth - CARD_W - CARD_MARGIN));
        const newY = Math.max(CARD_MARGIN, Math.min(dragRef.current.origY + dy, window.innerHeight - 60));
        setPos({ x: newX, y: newY });
      }

      function onUp() {
        dragRef.current = null;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
    },
    [pinned, pos]
  );

  // ═══════════════════════════════════════════
  //  滚动到顶部 / 底部
  // ═══════════════════════════════════════════
  const scrollToTop = useCallback(() => {
    bodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const scrollToBottom = useCallback(() => {
    followBottomRef.current = true;
    const el = bodyRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, []);

  // ═══════════════════════════════════════════
  //  保存相关逻辑（追问整树保存 + 子卡单存 + 更新整树）
  // ═══════════════════════════════════════════
  async function resolveAuth(): Promise<{ token: string; baseUrl: string } | null> {
    const preHint = await loadCrowAuth();
    const auth = await ensureFreshAuth(preHint, { force: true });
    if (!auth?.accessToken) {
      setSaveError('expired');
      return null;
    }
    onSessionUpdate?.(auth);
    const baseUrl = (auth.apiBaseUrl || config.apiBaseUrl).replace(/\/+$/, '');
    return { token: auth.accessToken, baseUrl };
  }

  async function findDuplicate(baseUrl: string, token: string): Promise<DuplicateHit | null> {
    const q = encodeURIComponent(text.trim());
    const res = await fetch(`${baseUrl}/api/notes?q=${q}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      data?: Array<{ id: string; inputText: string; explanation: string; parentText?: string }>;
    };
    const needle = normalizeNoteInput(text);
    const hit = (body.data ?? []).find(
      (n) => normalizeNoteInput(n.inputText) === needle && !n.parentText
    );
    return hit ? { id: hit.id, inputText: hit.inputText, explanation: hit.explanation } : null;
  }

  async function deleteNote(baseUrl: string, token: string, id: string): Promise<boolean> {
    const res = await fetch(`${baseUrl}/api/notes/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  }

  /**
   * 整树循环专用：把 item POST 出去——带 parentNoteId（账号版用 server id）
   * 401/403 自动 ensureFreshAuth 换票重试一次（与 handleSave 一致）。
   */
  async function postItemWithParent(
    baseUrl: string,
    token: string,
    item: TreeSnapshotItem,
    parentNoteId: string | undefined,
    tags: string[]
  ): Promise<{ ok: true; noteId: string } | { ok: false; error: string }> {
    let workingToken = token;
    const body = {
      inputText: item.text,
      explanation: item.explanation,
      source: 'chrome_extension' as const,
      tags,
      clientNoteId: item.clientNoteId,
      parentId: parentNoteId,
      parentText: item.parentText ?? undefined,
    };
    let res = await fetch(`${baseUrl}/api/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${workingToken}` },
      body: JSON.stringify(body),
    });
    if (res.status === 401 || res.status === 403) {
      const after = await ensureFreshAuth(await loadCrowAuth(), { force: true });
      if (!after?.accessToken) return { ok: false, error: 'auth-expired' };
      onSessionUpdate?.(after);
      workingToken = after.accessToken;
      res = await fetch(`${baseUrl}/api/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${workingToken}` },
        body: JSON.stringify(body),
      });
    }
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const data = (await res.json()) as { data?: { id: string } };
    const id = data.data?.id;
    if (!id) return { ok: false, error: 'no-id-in-response' };
    return { ok: true, noteId: id };
  }

  /**
   * 根整树保存（W3：父失败 → 子整链失败；W8：允许部分成功）。
   * 步骤：拍快照 → BFS 序 POST，缺 parentNoteId 标 parent-failed。
   */
  async function runTreeSave(
    baseUrl: string,
    token: string,
    snapshot: TreeSnapshotItem[],
    tags: string[]
  ): Promise<{
    cardIdToNoteId: Map<string, string>;
    failedIds: Set<string>;
  }> {
    const cardIdToNoteId = new Map<string, string>();
    const failedIds = new Set<string>();
    for (const item of snapshot) {
      const parentNoteId = item.parentCardId ? cardIdToNoteId.get(item.parentCardId) : undefined;
      if (item.parentCardId && !parentNoteId) {
        // 父失败（W3）→ 子链整链失败，不再重试
        failedIds.add(item.cardId);
        continue;
      }
      const result = await postItemWithParent(baseUrl, token, item, parentNoteId, tags);
      if (result.ok) {
        cardIdToNoteId.set(item.cardId, result.noteId);
      } else {
        failedIds.add(item.cardId);
        if (result.error === 'auth-expired') setSaveError('expired');
      }
    }
    return { cardIdToNoteId, failedIds };
  }

  /**
   * 拍快照（W7：拍下后 children state 变化不污染已发起 POST）。
   * 注册表快照 + 每个子卡的 ref-getter → flattenTree 拍出 BFS 序 items。
   */
  function captureTreeSnapshot(): TreeSnapshotItem[] {
    const explanations = new Map<string, string>();
    for (const [id, get] of childExplanationGettersRef.current) {
      explanations.set(id, get());
    }
    return flattenTree(liveNodes, explanations, explanationRef.current, rootClientNoteId);
  }

  /**
   * 整树保存主入口（W3+W7+W8）。仅根调用。
   * 查重：先单查根命中；若命中 → 弹窗走 handleReplaceTree；否则 → 拍快照 + runTreeSave。
   */
  async function handleSaveTree() {
    if (depth !== 0) return;
    if (!hasExplainReady) return;
    if (treeStatus === 'saving') return;
    setSaveError(null);
    setIsSaving(true);
    setTreeStatus('saving');
    try {
      const auth = await resolveAuth();
      if (!auth) {
        setIsSaving(false);
        setTreeStatus('unsaved');
        setSaveError('expired'); // 不再静默：提示登录/连接过期
        return;
      }
      const dup = await findDuplicate(auth.baseUrl, auth.token);
      if (dup) {
        setDuplicate(dup);
        setIsSaving(false);
        setTreeStatus('unsaved');
        return;
      }

      const snapshot = captureTreeSnapshot();
      if (snapshot.length === 0) {
        // 单卡（无追问）或根未进注册表时，降级为「单存单卡」，保证有提示、能入库；
        // 正常情况下单卡由 RootFooter 直接走 onSaveAlone，不会进这里。
        setIsSaving(false);
        setTreeStatus('unsaved');
        setSaveError('generic');
        return;
      }

      const tags = tag ? [tag] : [];
      const { cardIdToNoteId, failedIds } = await runTreeSave(auth.baseUrl, auth.token, snapshot, tags);

      // 更新 childStatuses
      const newStatuses: Record<string, ChildTreeSaveStatus> = {};
      for (const item of snapshot) {
        if (item.cardId === selfId) continue;
        const noteId = cardIdToNoteId.get(item.cardId);
        newStatuses[item.cardId] = noteId
          ? { kind: 'saved', noteId }
          : { kind: 'failed', error: 'http-error-or-parent-failed' };
      }
      setChildStatuses(newStatuses);

      const rootNoteId = cardIdToNoteId.get(selfId);
      const savedCount = cardIdToNoteId.size;
      const totalCount = snapshot.length;
      setTreeSaveStats({ savedCount, totalCount });

      if (failedIds.size === 0 && rootNoteId) {
        setTreeStatus('saved');
        setSavedId(rootNoteId);
        setDuplicate(null);
      } else if (savedCount > 0) {
        setTreeStatus('partial');
        setSavedId(null);
      } else {
        setTreeStatus('unsaved');
        setSaveError('generic');
      }
    } catch (e) {
      console.error('[saveTree]', e);
      setSaveError('generic');
      setTreeStatus('unsaved');
    } finally {
      setIsSaving(false);
    }
  }

  /**
   * 「更新到笔记本」按钮：GET /api/notes 全量 → 按 rootClientNoteId 过滤 → 循环 DELETE → 整树重存
   */
  async function handleUpdateTree() {
    if (depth !== 0) return;
    if (!hasExplainReady) return;
    if (treeStatus === 'saving') return;
    setSaveError(null);
    setIsSaving(true);
    try {
      const auth = await resolveAuth();
      if (!auth) {
        setIsSaving(false);
        return;
      }
      // GET 全量
      const listRes = await fetch(`${auth.baseUrl}/api/notes`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      if (!listRes.ok) {
        setSaveError('generic');
        setIsSaving(false);
        return;
      }
      const body = (await listRes.json()) as {
        data?: Array<{ id: string; clientNoteId?: string }>;
      };
      const oldIds = (body.data ?? [])
        .filter((n) => n.clientNoteId === rootClientNoteId)
        .map((n) => n.id);
      // 先删旧（删除失败不阻塞——决策：DELETE 失败时继续）
      for (const id of oldIds) await deleteNote(auth.baseUrl, auth.token, id).catch(() => undefined);
      // 重存：复用 runTreeSave
      setIsSaving(false); // 释放锁后让 handleSaveTree 自己锁
      setTreeStatus('unsaved'); // 让 handleSaveTree 接受
      await handleSaveTree();
    } catch (e) {
      console.error('[updateTree]', e);
      setSaveError('generic');
      setIsSaving(false);
    }
  }

  /**
   * 「覆盖旧的」（W4：整树查重命中时升级为整树覆盖语义）。
   * 旧单条先删 + 同 clientNoteId 全删 → 拍快照 → 整树重存。
   */
  async function handleReplaceTree() {
    if (depth !== 0) return;
    if (!hasExplainReady) return;
    if (!duplicate) return;
    setSaveError(null);
    setIsSaving(true);
    try {
      const auth = await resolveAuth();
      if (!auth) {
        setIsSaving(false);
        return;
      }
      // 旧命中单条先删
      await deleteNote(auth.baseUrl, auth.token, duplicate.id).catch(() => undefined);
      // 全量查同 clientNoteId 的旧本树 note（如果有的话）
      const listRes = await fetch(`${auth.baseUrl}/api/notes`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      if (listRes.ok) {
        const body = (await listRes.json()) as {
          data?: Array<{ id: string; clientNoteId?: string }>;
        };
        const oldIds = (body.data ?? [])
          .filter((n) => n.clientNoteId === rootClientNoteId)
          .map((n) => n.id);
        for (const id of oldIds) await deleteNote(auth.baseUrl, auth.token, id).catch(() => undefined);
      }
      setDuplicate(null);
      setIsSaving(false);
      setTreeStatus('unsaved');
      await handleSaveTree();
    } catch (e) {
      console.error('[replaceTree]', e);
      setSaveError('generic');
      setIsSaving(false);
    }
  }

  async function handleSave() {
    setSaveError(null);
    setIsSaving(true);
    try {
      const auth = await resolveAuth();
      if (!auth) { setSaveError('expired'); return; }
      const hit = await findDuplicate(auth.baseUrl, auth.token);
      if (hit) { setDuplicate(hit); return; }
      const ok = await saveWithToken(auth.baseUrl, auth.token, 'create');
      if (ok) {
        // 单存单卡：驱动根 footer 的「已存」态（与整树保存一致，避免无成功提示）
        setTreeStatus('saved');
        setTreeSaveStats({ savedCount: 1, totalCount: 1 });
      }
    } catch { setSaveError('generic'); } finally { setIsSaving(false); }
  }

  async function handleKeepBoth() {
    setSaveError(null);
    setIsSaving(true);
    try {
      const auth = await resolveAuth();
      if (!auth) return;
      await saveWithToken(auth.baseUrl, auth.token, 'create');
    } catch { setSaveError('generic'); } finally { setIsSaving(false); }
  }

  async function handleReplace() {
    if (!duplicate) return;
    setSaveError(null);
    setIsSaving(true);
    try {
      const auth = await resolveAuth();
      if (!auth) return;
      await saveWithToken(auth.baseUrl, auth.token, 'replace', duplicate.id);
    } catch { setSaveError('generic'); } finally { setIsSaving(false); }
  }

  async function handleLoginSuccess(auth: CrowAuth) {
    setLoginOpen(false);
    setSaveError(null);
    onSessionUpdate?.(auth);
    if (duplicate) await handleReplace();
    else await handleSave();
  }

  async function saveWithToken(
    baseUrl: string,
    token: string,
    mode: 'create' | 'replace',
    oldId?: string
  ): Promise<boolean> {
    let workingToken = token;
    if (mode === 'replace' && oldId) {
      const deleted = await deleteNote(baseUrl, workingToken, oldId);
      if (!deleted) {
        const after = await ensureFreshAuth(await loadCrowAuth(), { force: true });
        if (!after?.accessToken) { setSaveError('expired'); return false; }
        onSessionUpdate?.(after);
        workingToken = after.accessToken;
        if (!(await deleteNote(baseUrl, workingToken, oldId))) { setSaveError('generic'); return false; }
      }
    }
    const tags = tag ? [tag] : [];
    let res = await fetch(`${baseUrl}/api/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${workingToken}` },
      body: JSON.stringify({ inputText: text, explanation, source: 'chrome_extension', tags }),
    });
    if (res.status === 401 || res.status === 403) {
      const after = await ensureFreshAuth(await loadCrowAuth(), { force: true });
      if (!after?.accessToken) { setSaveError('expired'); return false; }
      onSessionUpdate?.(after);
      res = await fetch(`${baseUrl}/api/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${after.accessToken}` },
        body: JSON.stringify({ inputText: text, explanation, source: 'chrome_extension', tags }),
      });
    }
    if (res.ok) {
      const data = await res.json();
      setSavedId(data.data?.id ?? 'saved');
      setDuplicate(null);
      return true;
    }
    setSaveError(res.status === 401 || res.status === 403 ? 'expired' : 'generic');
    return false;
  }

  /**
   * 子卡 footer「只存本条」入口（T05）：单存为独立 note（不传 parentId；clientNoteId 独立 UUID）。
   * 与整树无关，不进整树 clientNoteId 集合。
   */
  async function handleSaveChildOnly() {
    if (depth === 0) return;
    if (!hasExplainReady) return;
    setSaveError(null);
    setIsSaving(true);
    try {
      const auth = await resolveAuth();
      if (!auth) return;
      const tags = tag ? [tag] : [];
      const ownClientNoteId = crypto.randomUUID();
      const body = {
        inputText: text,
        explanation,
        source: 'chrome_extension' as const,
        tags,
        clientNoteId: ownClientNoteId,
      };
      let res = await fetch(`${auth.baseUrl}/api/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify(body),
      });
      if (res.status === 401 || res.status === 403) {
        const after = await ensureFreshAuth(await loadCrowAuth(), { force: true });
        if (!after?.accessToken) { setSaveError('expired'); return; }
        onSessionUpdate?.(after);
        res = await fetch(`${auth.baseUrl}/api/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${after.accessToken}` },
          body: JSON.stringify(body),
        });
      }
      if (res.ok) {
        const data = await res.json();
        setSavedId(data.data?.id ?? 'saved');
      } else {
        setSaveError('generic');
      }
    } catch {
      setSaveError('generic');
    } finally {
      setIsSaving(false);
    }
  }

  /**
   * 子卡在整树循环里失败后的「重试」入口（仅子卡 footer 显示）。
   * 重试只 POST 该子卡一条（独立 clientNoteId，不进整树集合）。
   * 父已存的 clientNoteId 不可重建（已删或仍存在）；保守做法：直接走「单存」语义。
   */
  async function handleRetryChildTreePost() {
    if (depth === 0) return;
    if (savedId) return;
    // 走「只存本条」语义；不再尝试把这一条绑回整树（clientNoteId 重建）
    await handleSaveChildOnly();
  }

  const handleFollowUpSubmit = useCallback(() => {
    const q = followUpText.trim();
    if (!q) return;
    followBottomRef.current = true;
    setChildren((prev) => [...prev, { id: crypto.randomUUID(), text: q }]);
    setFollowUpText('');
    setFollowUpOpen(false);
  }, [followUpText]);

  // ═══════════════════════════════════════════
  //  效果：子卡片出现/流式增长时跟随滚动到底部
  //  （子卡片无高度上限，增长撑大父卡片 body 的滚动区，
  //   ResizeObserver 挂在子卡片包裹层上才能感知内容变化）
  // ═══════════════════════════════════════════
  useEffect(() => {
    const el = bodyRef.current;
    if (!el || children.length === 0) return;
    const follow = () => {
      if (followBottomRef.current) el.scrollTop = el.scrollHeight;
    };
    follow();
    const ro = new ResizeObserver(follow);
    childNodesRef.current.forEach((node) => node && ro.observe(node));
    return () => ro.disconnect();
  }, [children]);

  // ═══════════════════════════════════════════
  //  渲染
  //  根卡（depth 0）外包 CardTreeProvider 并附索引层（TreeIndexLayer，
  //  与卡片同级渲染，避开 .crow-card 的 overflow:hidden 裁剪）；
  //  子卡只渲染注册器 + 卡片本体。
  // ═══════════════════════════════════════════
  const cardClassName = `crow-card${pinned ? ' pinned' : ''}${collapsed ? ' collapsed' : ''}`;

  // ── 子卡读自己的整树状态（深度 > 0）──
  const myTreeStatus: ChildTreeSaveStatus | undefined =
    depth > 0 ? parentSaveContext?.childStatuses[selfId] : undefined;

  const cardNode = (
    <div
      ref={cardRef}
      className={`${cardClassName}${myTreeStatus?.kind === 'failed' ? ' crow-card-failed' : ''}`}
      style={pinned ? { left: pos.x, top: pos.y } : { left: pos.x, top: pos.y }}
    >
      {/* ── 顶部拖拽把手 + 标题 ── */}
      <div
        className={`crow-card-header${pinned ? ' crow-draggable' : ''}`}
        onMouseDown={handleDragStart}
      >
        {pinned && <span className="crow-drag-handle" title="拖拽移动">⠿</span>}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="crow-card-label">
            这是啥？
            {(depth > 0 || children.length > 0) && (
              <button
                className="crow-collapse-badge"
                onClick={(e) => { e.stopPropagation(); setCollapsed((v) => !v); }}
                title={collapsed ? '展开内容' : '折叠内容'}
              >
                {collapsed ? '▶' : '▼'}
                {children.length > 0 ? ` ${children.length} 条追问` : ''}
              </button>
            )}
          </div>
          <div className="crow-card-query">
            {text.length > 80 ? text.slice(0, 80) + '…' : text}
          </div>
        </div>
        <div className="crow-header-actions">
          {depth === 0 && (
            <button
              className={`crow-pin-btn${pinned ? ' active' : ''}`}
              onClick={(e) => { e.stopPropagation(); setPinned((v) => !v); }}
              title={pinned ? '取消钉住' : '钉住卡片'}
              type="button"
            >
              {pinned ? '📍' : '📌'}
            </button>
          )}
          <button
            className="crow-close"
            onClick={() => (depth > 0 && onRemove ? onRemove(selfId) : onClose())}
            title={depth > 0 ? '删除此卡片' : '关闭 (Esc)'}
          >
            ×
          </button>
        </div>
      </div>

      {/* ── 可滚动内容区 ── */}
      <div ref={bodyRef} className={`crow-card-body${collapsed ? ' collapsed' : ''}`}>
        {!collapsed && (
          <>
            {isLoading && !explanation && (
              <div className="crow-loading">
                <span className="crow-dot" />
                <span className="crow-dot" />
                <span className="crow-dot" />
                <span style={{ marginLeft: 8 }}>正在思考中...</span>
              </div>
            )}
            {error && <div className="crow-error">{error}</div>}
            {loginOpen && (
              <div style={{ marginTop: explanation ? 10 : 0 }}>
                <CrowLoginForm
                  variant="card"
                  onSuccess={(auth) => void handleLoginSuccess(auth)}
                  onCancel={() => setLoginOpen(false)}
                />
                {onConnectPlugin && (
                  <p style={{ fontSize: 11, color: '#52525b', margin: '8px 0 0' }}>
                    无法登录？
                    <button
                      type="button"
                      onClick={onConnectPlugin}
                      style={{
                        background: 'none', border: 'none', color: '#fb923c',
                        cursor: 'pointer', padding: 0, textDecoration: 'underline', fontSize: 11,
                      }}
                    >
                      打开扩展设置
                    </button>
                  </p>
                )}
              </div>
            )}
            {explanation && !duplicate && (
              <span>
                {explanation}
                {isLoading && <span className="crow-cursor" />}
              </span>
            )}
            {duplicate && (
              <div style={{ fontSize: 12, lineHeight: 1.5 }}>
                <p style={{ color: '#fb923c', margin: '0 0 8px' }}>已有同名笔记，请选择：</p>
                <p style={{ color: '#a1a1aa', margin: '0 0 4px' }}>旧答案（截断）：</p>
                <p style={{ color: '#d4d4d8', margin: '0 0 8px' }}>
                  {duplicate.explanation.length > 160
                    ? duplicate.explanation.slice(0, 160) + '…'
                    : duplicate.explanation}
                </p>
                <p style={{ color: '#a1a1aa', margin: '0 0 4px' }}>新答案（截断）：</p>
                <p style={{ color: '#fafafa', margin: 0 }}>
                  {(explanation ?? '').length > 160
                    ? (explanation ?? '').slice(0, 160) + '…'
                    : explanation}
                </p>
              </div>
            )}
          </>
        )}

        {/* 递归子卡片 */}
        {children.map((child) => (
          <div
            key={child.id}
            className="crow-child-card"
            ref={(node) => {
              if (node) childNodesRef.current.set(child.id, node);
              else childNodesRef.current.delete(child.id);
            }}
          >
            <ExplainCard
              text={child.text}
              surroundingText={explanation}
              anchorX={0}
              anchorY={0}
              config={config}
              isAuthenticated={isAuthenticated}
              onConnectPlugin={onConnectPlugin}
              onSessionUpdate={onSessionUpdate}
              onClose={() => {}}
              onRemove={(id) => setChildren((prev) => prev.filter((c) => c.id !== id))}
              history={[
                ...(history ?? []),
                { question: text, explanation: explanation ?? '' },
              ]}
              depth={depth + 1}
              cardId={child.id}
              parentId={selfId}
              parentSaveContext={depth === 0 ? parentSaveContextValue : parentSaveContext}
              registerExplanationGetter={depth === 0 ? registerChildExplanationGetter : registerExplanationGetter}
              unregisterExplanationGetter={depth === 0 ? unregisterChildExplanationGetter : unregisterExplanationGetter}
            />
          </div>
        ))}
      </div>

      {/* ── 滚动箭头 ── */}
      {canScroll && !collapsed && (
        <div className="crow-scroll-arrows">
          <button
            className="crow-scroll-arrow"
            onClick={scrollToTop}
            disabled={scrollAtTop}
            title="回到顶部"
            type="button"
          >
            ↑
          </button>
          <button
            className="crow-scroll-arrow"
            onClick={scrollToBottom}
            disabled={scrollAtBottom}
            title="滚到底部"
            type="button"
          >
            ↓
          </button>
        </div>
      )}

      {quotaOut && isDone && (
        <div className="crow-hint" style={{ fontSize: 11 }}>
          今日免费额度已用完，本次使用免费模型
        </div>
      )}

      {/* ── 底部操作栏 ── */}
      {showSaveFooter && (
        <div className="crow-card-footer">
          {!isAuthenticated ? (
            loginOpen ? (
              <span className="crow-hint" style={{ fontSize: 12 }}>
                登录后即可存入笔记本
              </span>
            ) : (
              <button
                className="crow-save-btn"
                onClick={() => setLoginOpen(true)}
                type="button"
                title="在本卡片内登录，登录后自动继续保存"
              >
                登录后可保存
              </button>
            )
          ) : depth === 0 ? (
            // 根卡 footer 三态
            <RootFooter
              status={treeStatus}
              saveStats={treeSaveStats}
              childrenCount={children.length}
              hasExplainReady={hasExplainReady}
              isSaving={isSaving}
              saveError={saveError}
              tag={tag}
              duplicate={duplicate}
              onSaveTree={handleSaveTree}
              onSaveAlone={handleSave}
              onUpdateTree={handleUpdateTree}
              onKeepBoth={handleKeepBoth}
              onReplace={handleReplaceTree}
              notebookUrl={notebookUrl}
              onFollowUpToggle={() => setFollowUpOpen((v) => !v)}
              followUpOpen={followUpOpen}
            />
          ) : (
            // 子卡 footer
            <ChildFooter
              status={myTreeStatus?.kind ?? 'idle'}
              hasExplainReady={hasExplainReady}
              isSaving={isSaving}
              savedId={savedId}
              saveError={saveError}
              onSaveOnly={handleSaveChildOnly}
              onRetry={handleRetryChildTreePost}
              onFollowUpToggle={() => setFollowUpOpen((v) => !v)}
              followUpOpen={followUpOpen}
            />
          )}
        </div>
      )}

      {/* ── 追问输入框 ── */}
      {followUpOpen && (
        <div className="crow-followup">
          <input
            autoFocus
            aria-label="追问问题"
            value={followUpText}
            onChange={(e) => setFollowUpText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
              handleFollowUpSubmit();
            }}
            placeholder="输入你想追问的问题，回车发送"
            className="crow-followup-input"
          />
          <button
            onClick={handleFollowUpSubmit}
            disabled={!followUpText.trim()}
            className="crow-followup-btn"
            type="button"
          >
            发送
          </button>
        </div>
      )}
    </div>
  );

  const registration = (
    <CardTreeRegistration
      id={selfId}
      question={text}
      parentId={depth === 0 ? null : parentId ?? null}
      depth={depth}
      getEl={getSelfEl}
      expand={expandSelf}
      getExplanation={() => explanationRef.current}
    />
  );

  if (depth === 0) {
    return (
      <CardTreeProvider stopFollow={stopFollow} getScrollContainer={getScrollContainer}>
        {registration}
        {cardNode}
        <TreeIndexLayer layerRef={indexLayerRef} pos={pos} />
      </CardTreeProvider>
    );
  }
  return (
    <>
      {registration}
      {cardNode}
    </>
  );
}

/** 根卡 footer：根据 treeStatus 渲染三态（未存/已存/部分失败）+ 查重弹窗 + 整树按钮 + 更新按钮 */
function RootFooter({
  status,
  saveStats,
  childrenCount,
  hasExplainReady,
  isSaving,
  saveError,
  tag,
  duplicate,
  onSaveTree,
  onSaveAlone,
  onUpdateTree,
  onKeepBoth,
  onReplace,
  notebookUrl,
  onFollowUpToggle,
  followUpOpen,
}: {
  status: TreeSaveStatus;
  saveStats: { savedCount: number; totalCount: number };
  childrenCount: number;
  hasExplainReady: boolean;
  isSaving: boolean;
  saveError: 'generic' | 'expired' | null;
  tag: string | null | undefined;
  duplicate: DuplicateHit | null;
  onSaveTree: () => void | Promise<void>;
  onSaveAlone: () => void | Promise<void>;
  onUpdateTree: () => void | Promise<void>;
  onKeepBoth: () => void | Promise<void>;
  onReplace: () => void | Promise<void>;
  notebookUrl: string;
  onFollowUpToggle: () => void;
  followUpOpen: boolean;
}) {
  const wholeTreeMode = childrenCount >= 1;

  return (
    <>
      {saveError === 'expired' ? (
        <span className="crow-error" style={{ fontSize: 12 }}>
          ⚠️ 登录或连接已过期，
          <button
            type="button"
            style={{
              background: 'none', border: 'none', color: '#fb923c',
              cursor: 'pointer', padding: 0, textDecoration: 'underline', fontSize: 12,
            }}
          >
            重新登录
          </button>
          后自动继续保存，或
          <a
            href={notebookUrl}
            target="_blank"
            rel="noreferrer"
            style={{ color: '#fb923c', marginLeft: 2 }}
          >
            回网站点「连接插件」
          </a>
        </span>
      ) : saveError === 'generic' ? (
        <span className="crow-error" style={{ fontSize: 12 }}>保存失败，请稍后重试</span>
      ) : duplicate ? (
        <>
          <button
            className="crow-save-btn"
            onClick={() => void onKeepBoth()}
            disabled={isSaving}
            type="button"
          >
            {isSaving ? '保存中…' : '都保留'}
          </button>
          <span className="crow-sep">·</span>
          <button
            className="crow-save-btn"
            onClick={() => void onReplace()}
            disabled={isSaving}
            type="button"
            style={{ color: '#fb923c' }}
            title="覆盖整棵追问树"
          >
            覆盖旧的
          </button>
          {wholeTreeMode && (
            <span className="crow-hint" style={{ fontSize: 11, marginLeft: 4 }}>
              （将覆盖旧的整棵追问树）
            </span>
          )}
        </>
      ) : status === 'saving' ? (
        <button className="crow-save-btn" disabled type="button">
          保存中…
        </button>
      ) : status === 'saved' ? (
        <>
          <button className="crow-save-btn saved" disabled type="button">
            ✓ 已存 {saveStats.savedCount} 条
          </button>
          {wholeTreeMode && (
            <>
              <span className="crow-sep">·</span>
              <button
                className="crow-save-btn"
                onClick={() => void onUpdateTree()}
                disabled={isSaving || !hasExplainReady}
                type="button"
              >
                更新到笔记本
              </button>
            </>
          )}
        </>
      ) : status === 'partial' ? (
        <>
          <button className="crow-save-btn crow-save-partial" disabled type="button">
            ⚠️ 已存 {saveStats.savedCount}/{saveStats.totalCount} 条
          </button>
          {wholeTreeMode && (
            <>
              <span className="crow-sep">·</span>
              <button
                className="crow-save-btn"
                onClick={() => void onUpdateTree()}
                disabled={isSaving || !hasExplainReady}
                type="button"
                style={{ color: '#fb923c' }}
              >
                重试整树
              </button>
            </>
          )}
        </>
      ) : (
        <>
          <button
            className="crow-save-btn"
            onClick={() => (wholeTreeMode ? void onSaveTree() : void onSaveAlone())}
            disabled={isSaving || !hasExplainReady}
            type="button"
          >
            {isSaving
              ? '保存中…'
              : wholeTreeMode
                ? `存入笔记本（连同 ${childrenCount} 条追问）`
                : '存入笔记本'}
          </button>
          {wholeTreeMode && (
            <>
              <span className="crow-sep">·</span>
              <button
                className="crow-save-btn crow-save-secondary"
                onClick={() => void onSaveAlone()}
                disabled={isSaving || !hasExplainReady}
                type="button"
                style={{ fontSize: 11, color: '#71717a' }}
                title="只保存当前卡片，不包含追问"
              >
                只存本条
              </button>
            </>
          )}
        </>
      )}
      {tag && status === 'unsaved' && !duplicate && (
        <span className="crow-hint" style={{ fontSize: 12, color: '#34d399' }} title="保存时自动带上这个分类">
          🏷 {tag}
        </span>
      )}
      <span className="crow-sep">·</span>
      <a className="crow-save-btn" href={notebookUrl} target="_blank" rel="noreferrer">
        打开笔记本
      </a>
      <span className="crow-sep">·</span>
      <button
        className="crow-save-btn"
        onClick={onFollowUpToggle}
        type="button"
      >
        {followUpOpen ? '收起追问' : '追问'}
      </button>
    </>
  );
}

/** 子卡 footer：独立 savedId；整树失败时红框 + 重试 */
function ChildFooter({
  status,
  hasExplainReady,
  isSaving,
  savedId,
  saveError,
  onSaveOnly,
  onRetry,
  onFollowUpToggle,
  followUpOpen,
}: {
  status: 'idle' | 'saving' | 'saved' | 'failed';
  hasExplainReady: boolean;
  isSaving: boolean;
  savedId: string | null;
  saveError: 'generic' | 'expired' | null;
  onSaveOnly: () => void | Promise<void>;
  onRetry: () => void | Promise<void>;
  onFollowUpToggle: () => void;
  followUpOpen: boolean;
}) {
  return (
    <>
      {saveError === 'expired' ? (
        <span className="crow-error" style={{ fontSize: 12 }}>
          ⚠️ 登录或连接已过期，
          <button
            type="button"
            style={{
              background: 'none', border: 'none', color: '#fb923c',
              cursor: 'pointer', padding: 0, textDecoration: 'underline', fontSize: 12,
            }}
          >
            重新登录
          </button>
          后自动继续保存
        </span>
      ) : saveError === 'generic' ? (
        <span className="crow-error" style={{ fontSize: 12 }}>保存失败，请稍后重试</span>
      ) : status === 'failed' ? (
        <>
          <span className="crow-error" style={{ fontSize: 12 }}>⚠️ 保存失败</span>
          <span className="crow-sep">·</span>
          <button
            className="crow-save-btn"
            onClick={() => void onRetry()}
            disabled={isSaving}
            type="button"
            style={{ color: '#fb923c' }}
          >
            {isSaving ? '重试中…' : '重试'}
          </button>
        </>
      ) : savedId ? (
        <button className="crow-save-btn saved" disabled type="button">
          ✓ 已存入笔记本
        </button>
      ) : status === 'saving' ? (
        <button className="crow-save-btn" disabled type="button">
          保存中…
        </button>
      ) : (
        <button
          className="crow-save-btn"
          onClick={() => void onSaveOnly()}
          disabled={isSaving || !hasExplainReady}
          type="button"
        >
          存入笔记本
        </button>
      )}
      <span className="crow-sep">·</span>
      <button
        className="crow-save-btn"
        onClick={onFollowUpToggle}
        type="button"
      >
        {followUpOpen ? '收起追问' : '追问'}
      </button>
    </>
  );
}

/** 追问树形索引层：达到阈值时先显示左缘把手，点开后为浮层树（收起/展开由本组件自持） */
function TreeIndexLayer({
  layerRef,
  pos,
}: {
  layerRef: RefObject<HTMLDivElement | null>;
  pos: { x: number; y: number };
}) {
  const tree = useCardTree();
  const nodes = useCardTreeSnapshot();
  const [open, setOpen] = useState(false);
  const stats = useMemo(() => computeStats(nodes), [nodes]);
  const treeRows = useMemo(() => buildTree(nodes), [nodes]);

  // Esc 收起浮层：捕获阶段监听并 stopPropagation，抢先于 App 的 document 冒泡监听（后者会关整卡）
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setOpen(false);
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open]);

  if (!tree || !shouldShowIndex(stats)) return null;

  // 把手贴卡片左缘（右锚定，免去猜宽度）；卡片贴屏幕左缘时改为压在卡上，绝不越出视口
  const innerWidth = window.innerWidth;
  const handleRight = Math.min(innerWidth - pos.x + 2, innerWidth - 68);
  // 浮层在卡片左侧，越界时 clamp；maxHeight 随 top 收缩，保证不出视口下缘
  const panelLeft = Math.max(8, pos.x - TREE_PANEL_W - 10);
  const panelTop = Math.max(8, pos.y - 40);

  function renderTreeNodes(nodes: CardTreeTreeNode[], level: number): ReactNode {
    return nodes.map((n) => (
      <div key={n.id}>
        <button
          className="crow-tree-node"
          style={{ paddingLeft: 8 + level * 14 }}
          onClick={(e) => {
            e.stopPropagation();
            if (tree) tree.jumpTo(n.id);
          }}
          title={n.question}
          type="button"
        >
          <span className="crow-tree-node-text">{n.question}</span>
        </button>
        {n.children.length > 0 && renderTreeNodes(n.children, level + 1)}
      </div>
    ));
  }

  if (!open) {
    return (
      <div ref={layerRef} className="crow-index-layer">
        <button
          className="crow-tree-handle"
          style={{ right: handleRight, top: pos.y + 64 }}
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          title="展开追问目录"
          type="button"
        >
          ◀ 目录
        </button>
      </div>
    );
  }

  return (
    <div ref={layerRef} className="crow-index-layer">
      <div
        className="crow-tree-panel"
        style={{
          left: panelLeft,
          top: panelTop,
          maxHeight: `calc(100vh - ${panelTop + 8}px)`,
        }}
      >
        <div className="crow-tree-panel-header">
          <span>追问目录</span>
          <button
            className="crow-tree-panel-close"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(false);
            }}
            title="收起目录"
            type="button"
          >
            ×
          </button>
        </div>
        <div className="crow-tree-panel-body">{renderTreeNodes(treeRows, 0)}</div>
      </div>
    </div>
  );
}