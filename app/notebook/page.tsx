'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import type { NoteEntry } from '@/lib/db/notes';
import { AuthNav } from '@/components/AuthNav';
import { GuestMigrationModal } from '@/components/GuestMigrationModal';
import { useAuthSession } from '@/hooks/useAuthSession';
import { deleteNoteById, fetchNotes, patchNoteTags } from '@/lib/api/notes-client';
import {
  getGuestNotes,
  removeGuestNotes,
  updateGuestNoteTags,
  updateGuestNotesTags,
} from '@/lib/guest-notes';
import {
  collectCategories,
  matchesCategoryFilter,
  MAX_TAG_LENGTH,
  parseTagsInput,
  primaryCategory,
  type CategoryFilter,
} from '@/lib/notes/tags';

function formatDate(ts: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ts));
}

/**
 * 一组追问树：根 + 子卡列表（兄弟序按时间线）。
 * root.parentId === undefined；children 通过 n.parentId === root.id 反查。
 */
interface TreeGroup {
  root: NoteEntry;
  children: NoteEntry[];
}

/**
 * 按 parentId 反向分桶；root = !n.parentId。
 * 子卡「只存本条」为独立 root（parentId=undefined + 独立 clientNoteId）→ 单独一组。
 * 整树保存的子卡 parentId=root.id → 正确归到对应根的 children。
 */
function groupByParent(notes: NoteEntry[]): TreeGroup[] {
  const childrenByParent = new Map<string, NoteEntry[]>();
  for (const n of notes) {
    if (n.parentId) {
      const list = childrenByParent.get(n.parentId) ?? [];
      list.push(n);
      childrenByParent.set(n.parentId, list);
    }
  }
  // 子卡按时间线正序（老在前，新在后）
  for (const list of childrenByParent.values()) {
    list.sort((a, b) => a.savedAt - b.savedAt);
  }
  // root 候选：!n.parentId
  // 排序：根按时间倒序（新在前）
  return notes
    .filter((n) => !n.parentId)
    .sort((a, b) => b.savedAt - a.savedAt)
    .map((root) => ({
      root,
      children: childrenByParent.get(root.id) ?? [],
    }));
}

export default function NotebookPage() {
  const { accessToken, user, isLoading: sessionLoading } = useAuthSession();
  const [notes, setNotes] = useState<NoteEntry[] | null>(null);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  /** 树根级联删除确认弹窗（root.id → childCount） */
  const [cascadeConfirm, setCascadeConfirm] = useState<{ rootId: string; childCount: number } | null>(null);

  function loadGuestNotes(): NoteEntry[] {
    return getGuestNotes().map(
      (note): NoteEntry => ({
        id: note.clientNoteId,
        user_id: 'guest',
        inputText: note.inputText,
        explanation: note.explanation,
        parentId: note.parentId,
        parentText: note.parentText,
        source: note.source,
        savedAt: note.savedAt,
        tags: note.tags ?? [],
      })
    );
  }

  // 全量拉取一次（游客读本地），搜索在本地过滤——见 lib/notes-search.ts
  useEffect(() => {
    if (sessionLoading) return;
    let cancelled = false;

    (async () => {
      try {
        const data = accessToken ? await fetchNotes(accessToken) : loadGuestNotes();
        if (!cancelled) {
          setNotes(data);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setNotes([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accessToken, sessionLoading]);

  // 整组分桶
  const groups = useMemo<TreeGroup[]>(() => groupByParent(notes ?? []), [notes]);

  // 分类 + 关键词筛选：root 命中 → 整组可见（root 未命中 → 整组隐藏）
  // 简化：root 命中（inputText/explanation 命中关键词）→ 整组可见
  const visibleGroupsSimple = useMemo(() => {
    // 1. 分类筛选：root 命中 → 整组
    const byCategory = groups.filter((g) => matchesCategoryFilter(g.root.tags, categoryFilter));
    // 2. 关键词：root 命中（inputText/explanation）→ 整组可见；未命中 → 整组隐藏
    if (!query.trim()) return byCategory.map((g) => ({ group: g, visibleChildren: g.children.length }));
    const q = query.toLowerCase();
    return byCategory
      .filter((g) => {
        const rootHit =
          g.root.inputText.toLowerCase().includes(q) ||
          g.root.explanation.toLowerCase().includes(q);
        return rootHit;
      })
      .map((g) => ({ group: g, visibleChildren: g.children.length }));
  }, [groups, categoryFilter, query]);

  const categories = useMemo(() => collectCategories(notes ?? []), [notes]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /**
   * 删 root → 若有 children 弹「将同时删除 N 条追问」二次确认
   * 删 child → 直接 DELETE（无确认）
   */
  function handleDeleteRoot(rootId: string, childIds: string[]) {
    if (childIds.length >= 1) {
      setCascadeConfirm({ rootId, childCount: childIds.length });
      return;
    }
    deleteIds([rootId]);
  }

  function confirmCascadeDelete() {
    if (!cascadeConfirm) return;
    const rootId = cascadeConfirm.rootId;
    const childIds = (notes ?? [])
      .filter((n) => n.parentId === rootId)
      .map((n) => n.id);
    setCascadeConfirm(null);
    deleteIds([rootId, ...childIds]);
  }

  function cancelCascadeDelete() {
    setCascadeConfirm(null);
  }

  function deleteIds(ids: string[]) {
    if (ids.length === 0) return;
    startTransition(async () => {
      try {
        if (accessToken) {
          for (const id of ids) {
            try {
              await deleteNoteById(accessToken, id);
            } catch (e) {
              console.error('[deleteNote]', id, e);
            }
          }
        } else {
          removeGuestNotes(ids);
        }
        setNotes((prev) => (prev ?? []).filter((n) => !ids.includes(n.id)));
      } catch (err) {
        console.error(err);
      }
    });
  }

  /**
   * 父卡 tags 改动 → 整组同步：root.tags + 所有 child.tags 一起 PATCH
   * 失败策略：单条失败不阻塞其他（决策 #2 沿用）
   */
  function handleUpdateRootCategory(rootId: string, childIds: string[], tags: string[]) {
    const allIds = [rootId, ...childIds];
    startTransition(async () => {
      const successes: string[] = [];
      const failures: string[] = [];
      try {
        if (accessToken) {
          for (const id of allIds) {
            try {
              const updated = await patchNoteTags(accessToken, id, tags);
              successes.push(updated.id);
            } catch (e) {
              failures.push(id);
              console.error('[patchTags]', id, e);
            }
          }
          // 本地状态：成功的同步；失败的保持原值
          if (successes.length > 0) {
            setNotes((prev) =>
              (prev ?? []).map((n) => {
                const updated = successes.includes(n.id) ? { ...n, tags } : n;
                return updated;
              })
            );
          }
        } else {
          updateGuestNotesTags(allIds.map((id) => ({ clientNoteId: id, tags })));
          setNotes((prev) =>
            (prev ?? []).map((n) => (allIds.includes(n.id) ? { ...n, tags } : n))
          );
        }
        if (failures.length > 0) {
          alert(`${failures.length} 条更新失败，请刷新重试`);
        }
      } catch (err) {
        console.error(err);
        alert(err instanceof Error ? err.message : '更新分类失败');
      }
    });
  }

  function handleUpdateChildCategory(childId: string, tags: string[]) {
    // 子卡 tags 独立改（不联动父）：保留旧行为
    startTransition(async () => {
      try {
        if (accessToken) {
          const updated = await patchNoteTags(accessToken, childId, tags);
          setNotes((prev) => (prev ?? []).map((n) => (n.id === childId ? updated : n)));
        } else {
          updateGuestNoteTags(childId, tags);
          setNotes((prev) => (prev ?? []).map((n) => (n.id === childId ? { ...n, tags } : n)));
        }
      } catch (err) {
        console.error(err);
        alert(err instanceof Error ? err.message : '更新分类失败');
      }
    });
  }

  const isLoading = sessionLoading || notes === null;
  const hasAnyNotes = (notes?.length ?? 0) > 0;
  const showEmpty =
    !isLoading && visibleGroupsSimple.length === 0 && (hasAnyNotes || Boolean(query.trim()));

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <Link
          href="/"
          className="font-bold text-lg tracking-tight text-white hover:text-orange-400 transition-colors"
        >
          这是啥<span className="text-orange-400">？</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href="/settings"
            className="text-sm border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500 px-3 py-1.5 rounded-lg transition-colors"
          >
            设置
          </Link>
          <span className="text-sm text-zinc-500">这都是啥 — 笔记本</span>
          <AuthNav />
        </div>
      </header>

      <main className="flex-1 px-4 py-10 max-w-3xl mx-auto w-full">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1">笔记本</h1>
            <p className="text-zinc-500 text-sm">
              {isLoading
                ? '加载中...'
                : (notes?.length ?? 0) === 0
                  ? '还没存过任何东西'
                  : `${user ? '账号' : '游客'}共 ${notes!.length} 条${
                      categoryFilter !== 'all'
                        ? `，当前筛选 ${visibleGroupsSimple.length} 组`
                        : ''
                    }，上次那个玩意儿你还记得吗`}
            </p>
          </div>
          <Link
            href="/"
            className="text-sm border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-zinc-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            继续问
          </Link>
        </div>

        {!isLoading && hasAnyNotes && (
          <div className="mb-4 flex flex-wrap gap-2">
            <CategoryChip
              label="全部"
              active={categoryFilter === 'all'}
              onClick={() => setCategoryFilter('all')}
            />
            <CategoryChip
              label="未分类"
              active={categoryFilter === 'uncategorized'}
              onClick={() => setCategoryFilter('uncategorized')}
            />
            {categories.map((name) => (
              <CategoryChip
                key={name}
                label={name}
                active={categoryFilter === name}
                onClick={() => setCategoryFilter(name)}
              />
            ))}
          </div>
        )}

        {!isLoading && hasAnyNotes && (
          <div className="mb-6">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索笔记..."
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-base md:text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-orange-400 transition-colors"
            />
          </div>
        )}

        {isLoading ? (
          <div className="text-center py-20">
            <div className="flex items-center justify-center gap-2 text-zinc-500 text-sm">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse delay-150" />
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse delay-300" />
              <span>加载中...</span>
            </div>
          </div>
        ) : (notes?.length ?? 0) === 0 ? (
          <div className="text-center py-20">
            <p className="text-zinc-600 text-base mb-4">什么都没有，去问几个试试</p>
            <Link
              href="/"
              className="inline-block bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
            >
              这是啥？
            </Link>
          </div>
        ) : showEmpty ? (
          <div className="text-center py-20">
            <p className="text-zinc-600 text-base mb-4">
              {query || categoryFilter !== 'all'
                ? '没找到匹配的记录'
                : '什么都没有，去问几个试试'}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {visibleGroupsSimple.map(({ group, visibleChildren }) => (
              <TreeNoteCard
                key={group.root.id}
                root={group.root}
                childNotes={group.children}
                isRootExpanded={expanded.has(group.root.id)}
                onToggleRoot={() => toggleExpand(group.root.id)}
                onDelete={() => handleDeleteRoot(group.root.id, group.children.map((c) => c.id))}
                onUpdateRootCategory={(tags) => handleUpdateRootCategory(group.root.id, group.children.map((c) => c.id), tags)}
                onUpdateChildCategory={(childId, tags) => handleUpdateChildCategory(childId, tags)}
                onDeleteChild={(childId) => deleteIds([childId])}
                recentCategories={categories}
                isBusy={isPending}
                // 默认折叠整组；用户点开看子卡
                childCount={visibleChildren}
              />
            ))}
          </div>
        )}
      </main>

      {/* 级联删除二次确认 */}
      {cascadeConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={cancelCascadeDelete}
        >
          <div
            className="bg-zinc-900 border border-zinc-700 rounded-xl px-5 py-4 max-w-sm mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-zinc-100 text-sm mb-4">
              将同时删除 <span className="text-orange-400 font-semibold">{cascadeConfirm.childCount}</span> 条追问。确认
            </p>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={cancelCascadeDelete}
                className="text-sm text-zinc-500 hover:text-zinc-300"
              >
                取消
              </button>
              <button
                type="button"
                onClick={confirmCascadeDelete}
                className="text-sm bg-red-500 hover:bg-red-400 text-white px-4 py-1.5 rounded-lg"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      <GuestMigrationModal
        accessToken={accessToken}
        onMigrated={() => {
          if (accessToken) {
            fetchNotes(accessToken).then(setNotes).catch(console.error);
          }
        }}
      />
    </div>
  );
}

function CategoryChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
        active
          ? 'border-orange-400/80 bg-orange-500/15 text-orange-300'
          : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
      }`}
    >
      {label}
    </button>
  );
}

/**
 * 父卡 + 整组子卡的可折叠行：父徽章「追问对话 · N 条」、展开后显示子卡时间线
 */
function TreeNoteCard({
  root,
  childNotes,
  isRootExpanded,
  onToggleRoot,
  onDelete,
  onUpdateRootCategory,
  onUpdateChildCategory,
  onDeleteChild,
  recentCategories,
  isBusy,
  childCount,
}: {
  root: NoteEntry;
  childNotes: NoteEntry[];
  isRootExpanded: boolean;
  onToggleRoot: () => void;
  onDelete: () => void;
  onUpdateRootCategory: (tags: string[]) => void;
  onUpdateChildCategory: (childId: string, tags: string[]) => void;
  onDeleteChild: (childId: string) => void;
  recentCategories: string[];
  isBusy: boolean;
  childCount: number;
}) {
  const category = primaryCategory(root.tags);
  const [draftTag, setDraftTag] = useState('');
  const [editingRoot, setEditingRoot] = useState(false);

  function startEditingRoot() {
    setDraftTag(category ?? '');
    setEditingRoot(true);
  }

  function commitRootCategory() {
    const parsed = parseTagsInput(draftTag.trim() ? [draftTag] : []);
    if (!parsed.ok) {
      alert(parsed.error);
      return;
    }
    onUpdateRootCategory(parsed.tags);
    setEditingRoot(false);
  }

  return (
    <div className="border border-zinc-800 rounded-xl bg-zinc-900 overflow-hidden">
      {/* ── 父卡行：标题 + 徽章 + 折叠按钮 ── */}
      <div className="w-full flex items-start justify-between gap-3 px-4 py-3">
        <button
          onClick={onToggleRoot}
          className="flex-1 min-w-0 text-left hover:bg-zinc-800/50 -mx-2 px-2 py-1 rounded transition-colors"
        >
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            {root.source === 'chrome_extension' && (
              <span className="text-xs text-blue-400/70 font-medium shrink-0">插件</span>
            )}
            {category ? (
              <span className="text-xs text-emerald-400/80 font-medium shrink-0">{category}</span>
            ) : (
              <span className="text-xs text-zinc-600 font-medium shrink-0">未分类</span>
            )}
            {childCount >= 1 && (
              <span className="text-xs text-orange-400/80 font-medium shrink-0" title="追问对话">
                追问对话 · {childCount} 条
              </span>
            )}
            <p className="text-sm text-zinc-200 font-medium truncate">{root.inputText}</p>
          </div>
          <p className="text-xs text-zinc-600">{formatDate(root.savedAt)}</p>
        </button>
        <div className="flex flex-col items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onToggleRoot}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            title={isRootExpanded ? '收起整组' : '展开整组'}
          >
            <svg
              className={`w-4 h-4 text-zinc-500 transition-transform ${isRootExpanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── 父卡展开区：explanation + 分类编辑 + 整组删除 ── */}
      {isRootExpanded && (
        <div className="px-4 pb-4 border-t border-zinc-800">
          <p className="mt-3 text-sm text-zinc-100 leading-relaxed whitespace-pre-wrap">
            {root.explanation}
          </p>

          <div className="mt-4 flex flex-col gap-2">
            <p className="text-xs text-zinc-500">分类（整组同步改）</p>
            {editingRoot ? (
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={draftTag}
                  maxLength={MAX_TAG_LENGTH}
                  onChange={(e) => setDraftTag(e.target.value)}
                  placeholder="例如：RAG（留空=未分类）"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none focus:border-orange-400"
                />
                {recentCategories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {recentCategories.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setDraftTag(name)}
                        className="text-xs px-2 py-1 rounded border border-zinc-700 text-zinc-400 hover:border-zinc-500"
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setDraftTag(category ?? '');
                      setEditingRoot(false);
                    }}
                    className="text-xs text-zinc-500 hover:text-zinc-300"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={commitRootCategory}
                    className="text-xs text-orange-400 hover:text-orange-300 disabled:opacity-40"
                  >
                    保存分类
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-zinc-300">{category ?? '未分类'}</span>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={startEditingRoot}
                  className="text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-40"
                >
                  编辑分类
                </button>
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center justify-end">
            <button
              onClick={onDelete}
              disabled={isBusy}
              className="text-xs text-zinc-600 hover:text-red-400 disabled:opacity-40 transition-colors"
              title={childNotes.length >= 1 ? `将同时删除 ${childNotes.length} 条追问` : '删除该笔记'}
            >
              删除{childNotes.length >= 1 ? `（含 ${childNotes.length} 条追问）` : ''}
            </button>
          </div>

          {/* ── 子卡时间线 ── */}
          {childNotes.length > 0 && (
            <div className="mt-4 border-t border-zinc-800/50 pt-3 flex flex-col gap-2">
              {childNotes.map((child) => (
                <ChildNoteCard
                  key={child.id}
                  note={child}
                  onDelete={() => onDeleteChild(child.id)}
                  onUpdateCategory={(tags) => onUpdateChildCategory(child.id, tags)}
                  isBusy={isBusy}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** 子卡行：紧凑版，只有追问上下文 + explanation + 删除；分类编辑简化为内联 */
function ChildNoteCard({
  note,
  onDelete,
  onUpdateCategory,
  isBusy,
}: {
  note: NoteEntry;
  onDelete: () => void;
  onUpdateCategory: (tags: string[]) => void;
  isBusy: boolean;
}) {
  const category = primaryCategory(note.tags);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  function startEditing() {
    setDraft(category ?? '');
    setEditing(true);
  }

  function commit() {
    const parsed = parseTagsInput(draft.trim() ? [draft] : []);
    if (!parsed.ok) {
      alert(parsed.error);
      return;
    }
    onUpdateCategory(parsed.tags);
    setEditing(false);
  }

  return (
    <div className="border-l-2 border-zinc-800 pl-3 py-2 rounded-r">
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <span className="text-xs text-orange-400/70 font-medium shrink-0">追问</span>
        {note.source === 'chrome_extension' && (
          <span className="text-xs text-blue-400/70 font-medium shrink-0">插件</span>
        )}
        {editing ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <input
              type="text"
              value={draft}
              maxLength={MAX_TAG_LENGTH}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="分类"
              className="flex-1 min-w-0 bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-100 outline-none focus:border-orange-400"
            />
            <button
              type="button"
              onClick={commit}
              disabled={isBusy}
              className="text-xs text-orange-400 hover:text-orange-300 disabled:opacity-40"
            >
              保存
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(category ?? '');
                setEditing(false);
              }}
              className="text-xs text-zinc-500 hover:text-zinc-300"
            >
              取消
            </button>
          </div>
        ) : (
          <>
            {category ? (
              <span className="text-xs text-emerald-400/80 font-medium shrink-0">{category}</span>
            ) : null}
            <button
              type="button"
              onClick={startEditing}
              disabled={isBusy}
              className="text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-40"
              title="编辑分类"
            >
              {category ? '改' : '分'}
            </button>
          </>
        )}
        <p className="text-sm text-zinc-200 font-medium truncate flex-1 min-w-0">{note.inputText}</p>
      </div>
      {note.parentText && (
        <div className="mt-1 mb-2 px-2 py-1.5 bg-zinc-800/60 rounded text-xs">
          <p className="text-zinc-500 mb-0.5">追问时的上下文：</p>
          <p className="text-zinc-400 line-clamp-2">{note.parentText}</p>
        </div>
      )}
      <p className="text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap line-clamp-4">
        {note.explanation}
      </p>
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-zinc-600">{formatDate(note.savedAt)}</span>
        <button
          onClick={onDelete}
          disabled={isBusy}
          className="text-xs text-zinc-600 hover:text-red-400 disabled:opacity-40 transition-colors"
        >
          删除
        </button>
      </div>
    </div>
  );
}