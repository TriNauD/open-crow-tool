'use client';

import Link from 'next/link';
import { useAuthSession } from '@/hooks/useAuthSession';

export function AuthNav() {
  const { user, isLoading, signOut } = useAuthSession();

  if (isLoading) {
    return <span className="text-xs text-zinc-600">会话检查中...</span>;
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="text-sm border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-zinc-200 px-3 py-1.5 rounded-lg transition-colors"
        >
          登录
        </Link>
        <Link
          href="/register"
          className="text-sm bg-orange-500 hover:bg-orange-400 text-white px-3 py-1.5 rounded-lg transition-colors"
        >
          注册
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-zinc-500 hidden sm:inline">{user.email}</span>
      <button
        onClick={() => signOut()}
        className="text-sm border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-zinc-200 px-3 py-1.5 rounded-lg transition-colors"
      >
        退出
      </button>
    </div>
  );
}
