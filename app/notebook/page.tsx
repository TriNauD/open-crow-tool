'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import type { NoteEntry } from '@/lib/db/notes';
import { AuthNav } from '@/components/AuthNav';
import { GuestMigrationModal } from '@/components/GuestMigrationModal';
import { useAuthSession } from '@/hooks/useAuthSession';
import { deleteNoteById, fetchNotes, patchNoteTags } from '@/lib/api/notes-client';
import { getGuestNotes, removeGuestNote, updateGuestNoteTags } from '@/lib/guest-notes';
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

export default function NotebookPage() {
  const { accessToken, user, isLoading: sessionLoading } = useAuthSession();
  const [notes, setNotes] = useState<NoteEntry[] | null>(null);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  function loadGuestNotes(q?: string): NoteEntry[] {
    const keyword = q?.trim().toLowerCase() ?? '';
    const data = getGuestNotes().filter((note) => {
      if (!keyword) return true;
      return (
        note.inputText.toLowerCase().includes(keyword) ||
        note.explanation.toLowerCase().includes(keyword)
      );
    });

    return data.map(
      (note): NoteEntry => ({
        id: note.clientNoteId,
        user_id: 'guest',
        inputText: note.inputText,
        explanation: note.explanation,
        parentText: note.parentText,
        source: note.source,
        savedAt: note.savedAt,
        tags: note.tags ?? [],
      })
    );
  }

  useEffect(() => {
    if (sessionLoading) return;
    let cancelled = false;

    const timer = setTimeout(() => {
      (async () => {
        try {
          const data = accessToken
            ? await fetchNotes(accessToken, query)
            : loadGuestNotes(query);
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
    }, query.trim() ? 300 : 0);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, accessToken, sessionLoading]);

  const categories = useMemo(() => collectCategories(notes ?? []), [notes]);

  const visibleNotes = useMemo(() => {
    const list = notes ?? [];
    return list.filter((n) => matchesCategoryFilter(n.tags, categoryFilter));
  }, [notes, categoryFilter]);

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      if (accessToken) {
        await deleteNoteById(accessToken, id);
      } else {
        removeGuestNote(id);
      }
      setNotes((prev) => (prev ?? []).filter((n) => n.id !== id));
    });
  }

  function handleUpdateCategory(id: string, tags: string[]) {
    startTransition(async () => {
      try {
        if (accessToken) {
          const updated = await patchNoteTags(accessToken, id, tags);
          setNotes((prev) => (prev ?? []).map((n) => (n.id === id ? updated : n)));
        } else {
          updateGuestNoteTags(id, tags);
          setNotes((prev) =>
            (prev ?? []).map((n) => (n.id === id ? { ...n, tags } : n))
          );
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
    !isLoading && visibleNotes.length === 0 && (hasAnyNotes || Boolean(query.trim()));

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
                        ? `，当前筛选 ${visibleNotes.length} 条`
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
            {visibleNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                isExpanded={expanded.has(note.id)}
                onToggle={() => toggleExpand(note.id)}
                onDelete={() => handleDelete(note.id)}
                onUpdateCategory={(tags) => handleUpdateCategory(note.id, tags)}
                recentCategories={categories}
                isBusy={isPending}
              />
            ))}
          </div>
        )}
      </main>
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

function NoteCard({
  note,
  isExpanded,
  onToggle,
  onDelete,
  onUpdateCategory,
  recentCategories,
  isBusy,
}: {
  note: NoteEntry;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onUpdateCategory: (tags: string[]) => void;
  recentCategories: string[];
  isBusy: boolean;
}) {
  const category = primaryCategory(note.tags);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);

  function startEditing() {
    setDraft(category ?? '');
    setEditing(true);
  }

  function commitCategory() {
    const parsed = parseTagsInput(draft.trim() ? [draft] : []);
    if (!parsed.ok) {
      alert(parsed.error);
      return;
    }
    onUpdateCategory(parsed.tags);
    setEditing(false);
  }

  return (
    <div className="border border-zinc-800 rounded-xl bg-zinc-900 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-start justify-between gap-3 px-4 py-3 text-left hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            {note.parentText && (
              <span className="text-xs text-orange-400/70 font-medium shrink-0">追问</span>
            )}
            {note.source === 'chrome_extension' && (
              <span className="text-xs text-blue-400/70 font-medium shrink-0">插件</span>
            )}
            {category ? (
              <span className="text-xs text-emerald-400/80 font-medium shrink-0">{category}</span>
            ) : (
              <span className="text-xs text-zinc-600 font-medium shrink-0">未分类</span>
            )}
            <p className="text-sm text-zinc-200 font-medium truncate">{note.inputText}</p>
          </div>
          <p className="text-xs text-zinc-600">{formatDate(note.savedAt)}</p>
        </div>
        <svg
          className={`w-4 h-4 shrink-0 mt-0.5 text-zinc-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 border-t border-zinc-800">
          {note.parentText && (
            <div className="mt-3 mb-3 px-3 py-2 bg-zinc-800 rounded-lg">
              <p className="text-xs text-zinc-500 mb-1">追问时的上下文：</p>
              <p className="text-xs text-zinc-400 line-clamp-3">{note.parentText}</p>
            </div>
          )}
          <p className="mt-3 text-sm text-zinc-100 leading-relaxed whitespace-pre-wrap">
            {note.explanation}
          </p>

          <div className="mt-4 flex flex-col gap-2">
            <p className="text-xs text-zinc-500">分类</p>
            {editing ? (
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={draft}
                  maxLength={MAX_TAG_LENGTH}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="例如：RAG（留空=未分类）"
                  className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 outline-none focus:border-orange-400"
                />
                {recentCategories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {recentCategories.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => setDraft(name)}
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
                      setDraft(category ?? '');
                      setEditing(false);
                    }}
                    className="text-xs text-zinc-500 hover:text-zinc-300"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={commitCategory}
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
                  onClick={startEditing}
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
            >
              删除
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
