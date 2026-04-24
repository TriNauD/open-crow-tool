'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getNotes, deleteNote, searchNotes, type NoteEntry } from '@/lib/storage';

function formatDate(ts: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ts));
}

export default function NotebookPage() {
  const [notes, setNotes] = useState<NoteEntry[]>([]);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  useEffect(() => {
    setNotes(getNotes());
  }, []);

  const displayed = query.trim() ? searchNotes(query) : notes;

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function handleDelete(id: string) {
    deleteNote(id);
    setNotes(getNotes());
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Nav */}
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <Link
          href="/"
          className="font-bold text-lg tracking-tight text-white hover:text-orange-400 transition-colors"
        >
          这他妈是啥<span className="text-orange-400">？</span>
        </Link>
        <span className="text-sm text-zinc-500">这他妈都是啥 — 笔记本</span>
      </header>

      <main className="flex-1 px-4 py-10 max-w-3xl mx-auto w-full">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-1">笔记本</h1>
            <p className="text-zinc-500 text-sm">
              {notes.length === 0
                ? '还没存过任何东西'
                : `共 ${notes.length} 条，上次那个他妈的玩意儿你还记得吗`}
            </p>
          </div>
          <Link
            href="/"
            className="text-sm border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-zinc-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            继续问
          </Link>
        </div>

        {/* Search */}
        {notes.length > 0 && (
          <div className="mb-6">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索笔记..."
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-orange-400 transition-colors"
            />
          </div>
        )}

        {/* Notes list */}
        {displayed.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-zinc-600 text-base mb-4">
              {query ? '没找到匹配的记录' : '什么都没有，去问几个试试'}
            </p>
            {!query && (
              <Link
                href="/"
                className="inline-block bg-orange-500 hover:bg-orange-400 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
              >
                这他妈是啥？
              </Link>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {displayed.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                isExpanded={expanded.has(note.id)}
                onToggle={() => toggleExpand(note.id)}
                onDelete={() => handleDelete(note.id)}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function NoteCard({
  note,
  isExpanded,
  onToggle,
  onDelete,
}: {
  note: NoteEntry;
  isExpanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="border border-zinc-800 rounded-xl bg-zinc-900 overflow-hidden">
      {/* Header row */}
      <button
        onClick={onToggle}
        className="w-full flex items-start justify-between gap-3 px-4 py-3 text-left hover:bg-zinc-800/50 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            {note.parentText && (
              <span className="text-xs text-orange-400/70 font-medium shrink-0">追问</span>
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

      {/* Expanded content */}
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
          <div className="mt-4 flex items-center justify-end">
            <button
              onClick={onDelete}
              className="text-xs text-zinc-600 hover:text-red-400 transition-colors"
            >
              删除
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
