'use client';

import { useState } from 'react';
import { getGuestNotes, clearGuestNotes } from '@/lib/guest-notes';
import { migrateGuestNotesToUser } from '@/lib/api/notes-client';

interface GuestMigrationModalProps {
  accessToken: string | null;
  onMigrated?: () => void;
}

export function GuestMigrationModal({ accessToken, onMigrated }: GuestMigrationModalProps) {
  const [dismissed, setDismissed] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = !!accessToken && !dismissed && !completed && getGuestNotes().length > 0;

  async function handleConfirm() {
    if (!accessToken) return;
    setPending(true);
    setError(null);

    try {
      const notes = getGuestNotes();
      await migrateGuestNotesToUser(accessToken, notes);
      clearGuestNotes();
      setCompleted(true);
      onMigrated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : '迁移失败，请稍后重试');
    } finally {
      setPending(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center px-4">
      <div className="w-full max-w-md border border-zinc-800 rounded-xl bg-zinc-900 p-5">
        <h2 className="text-lg font-bold mb-2">检测到游客笔记</h2>
        <p className="text-sm text-zinc-400 mb-4">
          你登录前保存的游客笔记可以一次性迁移到当前账号。确认后会立刻导入。
        </p>

        {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

        <div className="flex items-center justify-end gap-2">
          <button
            disabled={pending}
            onClick={() => setDismissed(true)}
            className="text-sm border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-zinc-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
          >
            暂不迁移
          </button>
          <button
            disabled={pending}
            onClick={handleConfirm}
            className="text-sm bg-orange-500 hover:bg-orange-400 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
          >
            {pending ? '迁移中...' : '确认迁移'}
          </button>
        </div>
      </div>
    </div>
  );
}
