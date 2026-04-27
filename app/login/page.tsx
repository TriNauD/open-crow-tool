'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getBrowserSupabase, hasBrowserSupabaseEnv } from '@/lib/supabase/browser';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');
  const authConfigured = hasBrowserSupabaseEnv();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim() || state === 'loading') return;
    if (!authConfigured) {
      setState('error');
      setError('缺少 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 配置');
      return;
    }

    setState('loading');
    setError('');

    const supabase = getBrowserSupabase();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setState('error');
      setError(signInError.message);
      return;
    }

    window.location.href = '/notebook';
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="border-b border-zinc-800 px-6 py-4">
        <Link href="/" className="font-bold text-lg tracking-tight text-white hover:text-orange-400 transition-colors">
          这他妈是啥<span className="text-orange-400">？</span>
        </Link>
      </header>

      <main className="flex-1 px-4 py-12 flex items-center justify-center">
        <form onSubmit={onSubmit} className="w-full max-w-md border border-zinc-800 rounded-xl bg-zinc-900 p-6 space-y-4">
          <h1 className="text-xl font-bold">登录账号</h1>
          <p className="text-sm text-zinc-500">登录后你的笔记会按账号隔离保存。</p>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="邮箱"
            required
            className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm outline-none focus:border-orange-400"
          />

          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="密码"
              required
              className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 pr-16 py-2.5 text-sm outline-none focus:border-orange-400"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute inset-y-0 right-2 my-auto h-7 px-2 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
              aria-label={showPassword ? '隐藏密码' : '显示密码'}
            >
              {showPassword ? '隐藏' : '显示'}
            </button>
          </div>

          {state === 'error' && <p className="text-sm text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={state === 'loading'}
            className="w-full bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
          >
            {state === 'loading' ? '登录中...' : '登录'}
          </button>

          <p className="text-sm text-zinc-500">
            还没有账号？{' '}
            <Link href="/register" className="text-orange-400 hover:text-orange-300">
              去注册
            </Link>
          </p>
        </form>
      </main>
    </div>
  );
}
