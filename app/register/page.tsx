'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getBrowserSupabase, hasBrowserSupabaseEnv } from '@/lib/supabase/browser';

export default function RegisterPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [state, setState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [error, setError] = useState('');
  const authConfigured = hasBrowserSupabaseEnv();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim() || state === 'loading') return;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setState('error');
      setError('请输入有效的邮箱地址');
      return;
    }

    if (!authConfigured) {
      setState('error');
      setError('缺少 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 配置');
      return;
    }

    setState('loading');
    setError('');

    const supabase = getBrowserSupabase();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (signUpError) {
      setState('error');
      setError(signUpError.message);
      return;
    }

    // If email confirmation is disabled in Supabase, session may be available immediately.
    if (data.session) {
      window.location.href = '/notebook';
      return;
    }

    setState('success');
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="border-b border-zinc-800 px-6 py-4">
        <Link href="/" className="font-bold text-lg tracking-tight text-white hover:text-orange-400 transition-colors">
          这是啥<span className="text-orange-400">？</span>
        </Link>
      </header>

      <main className="flex-1 px-4 py-12 flex items-center justify-center">
        <form onSubmit={onSubmit} className="w-full max-w-md border border-zinc-800 rounded-xl bg-zinc-900 p-6 space-y-4">
          <h1 className="text-xl font-bold">注册账号</h1>
          <p className="text-sm text-zinc-500">创建账号后，笔记会和你的用户身份绑定。</p>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="邮箱"
            required
            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-base md:text-sm outline-none focus:border-orange-400"
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="密码（至少 6 位）"
            minLength={6}
            required
            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-base md:text-sm outline-none focus:border-orange-400"
          />

          {state === 'error' && <p className="text-sm text-red-400">{error}</p>}
          {state === 'success' && <p className="text-sm text-green-400">注册邮件已发送，请前往邮箱完成验证后再登录。</p>}

          <button
            type="submit"
            disabled={state === 'loading'}
            className="w-full touch-manipulation bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white text-base md:text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors min-h-[44px] md:min-h-0"
          >
            {state === 'loading' ? '注册中...' : '注册'}
          </button>

          <p className="text-sm text-zinc-500">
            已有账号？{' '}
            <Link href="/login" className="text-orange-400 hover:text-orange-300">
              去登录
            </Link>
          </p>
        </form>
      </main>
    </div>
  );
}
