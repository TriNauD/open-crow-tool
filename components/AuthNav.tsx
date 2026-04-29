'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useAuthSession } from '@/hooks/useAuthSession';
import { getBrowserSupabase, hasBrowserSupabaseEnv } from '@/lib/supabase/browser';

export function AuthNav() {
  const { user, isLoading, signOut, session: clientSession } = useAuthSession();
  const [extConnected, setExtConnected] = useState(false);
  const [connectHint, setConnectHint] = useState<string | null>(null);

  async function connectExtension() {
    if (!hasBrowserSupabaseEnv()) return;

    const supabase = getBrowserSupabase();
    let session: Session | null = null;

    try {
      const { data } = await supabase.auth.getSession();
      if (data.session?.access_token) {
        session = data.session;
      }
    } catch {
      /* 下面用 clientSession / refresh 兜底 */
    }

    /** 已登录页上 getSession 偶发与 React 态不同步；hook 里的 session 来自同一 client，可作权威兜底 */
    if (!session?.access_token && clientSession?.access_token) {
      session = clientSession;
    }

    /** 仍无 access_token 但有 user：尝试向 Supabase 要一轮新 session（含 access_token） */
    if (!session?.access_token && user) {
      try {
        const { data, error } = await supabase.auth.refreshSession();
        if (!error && data.session?.access_token) {
          session = data.session;
        }
      } catch {
        /* ignore */
      }
    }

    if (!session?.access_token) {
      setConnectHint('当前页读不到登录凭证，请先刷新页面后再点「连接插件」。');
      window.setTimeout(() => setConnectHint(null), 5000);
      return;
    }

    setConnectHint(null);
    // 乐观更新：先立即显示已连接，不等扩展回传
    setExtConnected(true);
    setTimeout(() => setExtConnected(false), 4000);

    window.postMessage(
      {
        type: 'CROW_CONNECT_EXT',
        accessToken: session.access_token,
        refreshToken: session.refresh_token ?? '',
        apiBaseUrl: window.location.origin,
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
        supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
        expiresAt:
          typeof session.expires_at === 'number' ? session.expires_at : undefined,
      },
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
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-xs text-zinc-500 hidden sm:inline">{user.email}</span>
      <button
        onClick={() => void connectExtension()}
        title="将当前登录状态同步给浏览器插件"
        className={`text-sm border px-3 py-1.5 rounded-lg transition-colors inline-flex items-center gap-1 ${
          extConnected
            ? 'border-green-700 text-green-400 cursor-default'
            : 'border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-zinc-200 cursor-pointer'
        }`}
      >
        {extConnected ? '✓ 插件已连接' : '连接插件'}
      </button>
      {connectHint ? (
        <span className="text-xs text-amber-400 max-w-[220px] leading-snug">{connectHint}</span>
      ) : null}
      <button
        onClick={() => signOut()}
        className="text-sm border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-zinc-200 px-3 py-1.5 rounded-lg transition-colors"
      >
        退出
      </button>
    </div>
  );
}
