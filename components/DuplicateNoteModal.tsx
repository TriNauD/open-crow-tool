'use client';

import type { NoteEntry } from '@/lib/db/notes';

function formatDate(ts: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ts));
}

interface DuplicateNoteModalProps {
  existing: NoteEntry;
  newExplanation: string;
  onKeepBoth: () => void;
  onReplace: () => void;
  pending?: boolean;
}

export function DuplicateNoteModal({
  existing,
  newExplanation,
  onKeepBoth,
  onReplace,
  pending = false,
}: DuplicateNoteModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-3xl border border-zinc-700 rounded-xl bg-zinc-900 flex flex-col max-h-[90vh]">
        <div className="px-5 pt-5 pb-3 border-b border-zinc-800 shrink-0">
          <h2 className="text-base font-bold">已有同名笔记</h2>
          <p className="text-xs text-zinc-500 mt-0.5">
            「{existing.inputText}」已存过一条笔记，这次的回答有所不同。
          </p>
        </div>

        {/* Comparison area — side-by-side on md+, stacked on mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-zinc-800 overflow-y-auto flex-1 min-h-0">
          {/* Old note */}
          <div className="p-4 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-400">旧答案</span>
              <span className="text-xs text-zinc-600">{formatDate(existing.savedAt)}</span>
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
              {existing.explanation}
            </p>
          </div>

          {/* New note */}
          <div className="p-4 flex flex-col gap-2 bg-zinc-800/30">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-orange-400">新答案</span>
              <span className="text-xs text-zinc-600">刚刚生成</span>
            </div>
            <p className="text-sm text-zinc-100 leading-relaxed whitespace-pre-wrap">
              {newExplanation}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-zinc-800 flex items-center justify-end gap-2 shrink-0">
          <button
            disabled={pending}
            onClick={onKeepBoth}
            className="text-sm border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-40"
          >
            都保留
          </button>
          <button
            disabled={pending}
            onClick={onReplace}
            className="text-sm bg-orange-500 hover:bg-orange-400 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-40"
          >
            {pending ? '保存中...' : '覆盖旧的'}
          </button>
        </div>
      </div>
    </div>
  );
}
