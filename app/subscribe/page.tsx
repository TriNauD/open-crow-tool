'use client';

import { useState } from 'react';
import Link from 'next/link';

type State = 'idle' | 'loading' | 'success' | 'reactivated' | 'already' | 'error';

export default function SubscribePage() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<State>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || state === 'loading') return;

    setState('loading');
    setErrorMsg('');

    try {
      const res = await fetch('/api/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error ?? '订阅失败，请稍后重试');
        setState('error');
        return;
      }

      if (data.alreadyExists) setState('already');
      else if (data.reactivated) setState('reactivated');
      else setState('success');
    } catch {
      setErrorMsg('网络错误，请稍后重试');
      setState('error');
    }
  }

  const done = state === 'success' || state === 'reactivated' || state === 'already';

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <Link
          href="/"
          className="font-bold text-lg tracking-tight text-white hover:text-orange-400 transition-colors"
        >
          这他妈是啥<span className="text-orange-400">？</span>
        </Link>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-16 max-w-2xl mx-auto w-full">
        {/* Hero */}
        <div className="text-center mb-12">
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-4 font-medium">
            GitHub 周报
          </p>
          <h1 className="text-4xl font-bold mb-4 leading-tight">
            速通本周 GH 热榜<br />
            <span className="text-orange-400">在火什么玩意</span>
          </h1>
          <p className="text-zinc-400 text-base leading-relaxed max-w-lg mx-auto">
            每周一自动爬取 GitHub Trending Top 20，AI 按五档评审，一封邮件告诉你哪些值得深挖、哪些纯粹凑数。
          </p>
        </div>

        {/* Preview card */}
        <div className="w-full mb-12 rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <div className="bg-zinc-800 px-4 py-3 flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500/60" />
            <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
            <div className="w-3 h-3 rounded-full bg-green-500/60" />
            <span className="text-xs text-zinc-500 ml-2">每周一封，邮件长这样</span>
          </div>
          <div className="p-5 space-y-4">
            <TierPreview
              label="🔥 夯"
              color="text-red-400"
              repos={[
                { name: 'some-org/crazy-new-thing', summary: '用纯 Rust 重写了整个 V8，居然跑通了 Node.js 生态，颠了' },
              ]}
            />
            <TierPreview
              label="⚡ 顶级"
              color="text-orange-400"
              repos={[
                { name: 'coolteam/ai-agent-framework', summary: '把 LLM 调用封成了状态机，多 Agent 协作不再是噩梦' },
                { name: 'another/dev-tool', summary: '本地运行的代码 Review 工具，扫完告诉你哪里写得像 NPC' },
              ]}
            />
            <TierPreview
              label="😐 NPC"
              color="text-zinc-400"
              repos={[
                { name: 'yetanother/todo-app', summary: '又一个 To-Do App，但是用了 AI，而且是用 Next.js 写的' },
              ]}
            />
          </div>
        </div>

        {/* Subscribe form */}
        {done ? (
          <div className="w-full text-center py-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-500/10 border border-green-500/30 mb-4">
              <svg className="w-7 h-7 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold mb-2">
              {state === 'already' ? '你已经订阅过了' : state === 'reactivated' ? '欢迎回来！' : '订阅成功！'}
            </h2>
            <p className="text-zinc-400 text-sm">
              {state === 'already'
                ? '这个邮箱已经在名单上了，下周一见。'
                : state === 'reactivated'
                ? `${email} 已重新加入，确认邮件已发送。`
                : `${email} 已加入，欢迎邮件已发送。`}
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="w-full max-w-md mx-auto space-y-3">
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                disabled={state === 'loading'}
                className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none focus:border-orange-400 transition-colors disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={state === 'loading' || !email.trim()}
                className="bg-orange-500 hover:bg-orange-400 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-3 rounded-lg transition-colors whitespace-nowrap"
              >
                {state === 'loading' ? '订阅中...' : '免费订阅'}
              </button>
            </div>

            {state === 'error' && (
              <p className="text-red-400 text-sm text-center">{errorMsg}</p>
            )}

            <p className="text-xs text-zinc-600 text-center">
              免费 · 每周一封 · 随时退订
            </p>
          </form>
        )}
      </main>
    </div>
  );
}

function TierPreview({
  label,
  color,
  repos,
}: {
  label: string;
  color: string;
  repos: { name: string; summary: string }[];
}) {
  return (
    <div>
      <p className={`text-xs font-bold mb-2 ${color}`}>{label}</p>
      <div className="space-y-2">
        {repos.map((r) => (
          <div key={r.name} className="border border-zinc-800 rounded-lg p-3 bg-zinc-800/50">
            <p className="text-xs font-medium text-zinc-300 mb-1">{r.name}</p>
            <p className="text-xs text-zinc-500 leading-relaxed">{r.summary}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
