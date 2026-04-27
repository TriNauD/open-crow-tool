'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAuthSession } from '@/hooks/useAuthSession';

export function AuthNav() {
  const { user, isLoading, signOut, accessToken } = useAuthSession();
  const [extConnected, setExtConnected] = useState(false);

  function connectExtension() {
    if (!accessToken) return;

    // 乐观更新：先立即显示已连接，不等扩展回传
    setExtConnected(true);
    setTimeout(() => setExtConnected(false), 4000);

    window.postMessage(
      { type: 'CROW_CONNECT_EXT', accessToken, apiBaseUrl: window.location.origin },
      '*'
    );
  }

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
        onClick={connectExtension}
        title="将当前登录状态同步给浏览器插件"
        className={`text-sm border px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1 ${
          extConnected
            ? 'border-green-700 text-green-400 cursor-default'
            : 'border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-zinc-200 cursor-pointer'
        }`}
      >
        {extConnected ? '✓ 插件已连接' : '连接插件'}
      </button>
      <button
        onClick={() => signOut()}
        className="text-sm border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-zinc-200 px-3 py-1.5 rounded-lg transition-colors"
      >
        退出
      </button>
    </div>
  );
}
