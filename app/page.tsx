'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import ExplanationCard from '@/components/ExplanationCard';
import { AuthNav } from '@/components/AuthNav';
import { GuestMigrationModal } from '@/components/GuestMigrationModal';
import { useAuthSession } from '@/hooks/useAuthSession';

interface Query {
  id: string;
  text: string;
}

const EXAMPLES = [
  'RAG 是啥',
  'MCP 协议',
  'attention mechanism',
  '向量数据库',
  'o3 模型',
  'Cursor Rules',
];

export default function HomePage() {
  const { accessToken } = useAuthSession();
  const [input, setInput] = useState('');
  const [queries, setQueries] = useState<Query[]>([]);
  const [notebookFlash, setNotebookFlash] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function submitQuery(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setQueries((prev) => [{ id: crypto.randomUUID(), text: trimmed }, ...prev]);
    setInput('');
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      submitQuery(input);
    }
  }

  function handleNotebookSave() {
    setNotebookFlash(true);
    setTimeout(() => setNotebookFlash(false), 2000);
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Nav */}
      <header className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <span className="font-bold text-lg tracking-tight text-white">
          这是啥<span className="text-orange-400">？</span>
        </span>
        <div className="flex items-center gap-3">
          <Link
            href="/notebook"
            className={`text-sm transition-colors px-3 py-1.5 rounded-lg border ${
              notebookFlash
                ? 'border-green-500 text-green-400 bg-green-500/10'
                : 'border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-500'
            }`}
          >
            {notebookFlash ? '已存入笔记本' : '笔记本'}
          </Link>
          <AuthNav />
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center px-4 py-12 max-w-3xl mx-auto w-full">
        {/* Hero */}
        {queries.length === 0 && (
          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold mb-3">
              这是<span className="text-orange-400">啥</span>？
            </h1>
            <p className="text-zinc-400 text-base">
              把任何让你头大的 AI 术语、新工具、震惊体新闻丢进来，用大白话告诉你这玩意儿是干嘛的。
            </p>
          </div>
        )}

        {/* Input */}
        <div className="w-full">
          <div className="relative rounded-xl border border-zinc-700 bg-zinc-900 focus-within:border-orange-400 transition-colors">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="粘贴文章标题、链接、截图文字，或者直接输入不懂的词..."
              rows={3}
              className="w-full bg-transparent resize-none rounded-xl px-4 pt-4 pb-12 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none leading-relaxed"
            />
            <div className="absolute bottom-3 right-3 flex items-center gap-2">
              <span className="text-xs text-zinc-600">⌘↵ 发送</span>
              <button
                onClick={() => submitQuery(input)}
                disabled={!input.trim()}
                className="bg-orange-500 hover:bg-orange-400 disabled:opacity-30 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors"
              >
                这是啥？
              </button>
            </div>
          </div>

          {/* Example pills */}
          {queries.length === 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  onClick={() => submitQuery(ex)}
                  className="text-xs text-zinc-500 border border-zinc-800 hover:border-zinc-600 hover:text-zinc-300 px-3 py-1 rounded-full transition-colors"
                >
                  {ex}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Explanation cards */}
        <div className="w-full mt-8 flex flex-col gap-6">
          {queries.map((q) => (
            <ExplanationCard
              key={q.id}
              inputText={q.text}
              onSaved={handleNotebookSave}
            />
          ))}
        </div>
      </main>
      <GuestMigrationModal accessToken={accessToken} />
    </div>
  );
}
