'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import ExplanationCard from '@/components/ExplanationCard';
import { AuthNav } from '@/components/AuthNav';
import { GuestMigrationModal } from '@/components/GuestMigrationModal';
import { useAuthSession } from '@/hooks/useAuthSession';
import { getKeyboardSendShortcutHintLabel } from '@/lib/keyboard-send-hint';
import { compressImageFile, type CompressedImage } from '@/lib/client/compress-image';
import type { ExplainImage } from '@/hooks/useStreamExplain';

interface Query {
  id: string;
  text: string;
  image?: ExplainImage;
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
  const [pendingImage, setPendingImage] = useState<CompressedImage | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [queries, setQueries] = useState<Query[]>([]);
  const [notebookFlash, setNotebookFlash] = useState(false);
  /** null = 未挂载；'' = 手机端等不展示快捷键提示；否则为文案 */
  const [sendShortcutHint, setSendShortcutHint] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setSendShortcutHint(getKeyboardSendShortcutHintLabel());
    });
  }, []);

  useEffect(() => {
    return () => {
      if (pendingImage?.previewUrl) {
        URL.revokeObjectURL(pendingImage.previewUrl);
      }
    };
  }, [pendingImage]);

  async function attachImageFile(file: File | Blob) {
    setImageError(null);
    try {
      if (pendingImage?.previewUrl) {
        URL.revokeObjectURL(pendingImage.previewUrl);
      }
      const compressed = await compressImageFile(file);
      setPendingImage(compressed);
    } catch (err) {
      console.error(err);
      setImageError('图片处理失败，请换一张较小的 png/jpg');
    }
  }

  function clearPendingImage() {
    if (pendingImage?.previewUrl) {
      URL.revokeObjectURL(pendingImage.previewUrl);
    }
    setPendingImage(null);
    setImageError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function submitQuery(text: string) {
    const trimmed = text.trim();
    if (!trimmed && !pendingImage) return;
    const image = pendingImage
      ? { mimeType: pendingImage.mimeType, dataBase64: pendingImage.dataBase64 }
      : undefined;
    setQueries((prev) => [
      { id: crypto.randomUUID(), text: trimmed || '（看图解释）', image },
      ...prev,
    ]);
    setInput('');
    clearPendingImage();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Enter') return;
    if (e.nativeEvent.isComposing) return;
    if (e.altKey || e.shiftKey) return;
    e.preventDefault();
    submitQuery(input);
  }

  async function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          await attachImageFile(file);
        }
        return;
      }
    }
  }

  function handleNotebookSave() {
    setNotebookFlash(true);
    setTimeout(() => setNotebookFlash(false), 2000);
  }

  const canSend = Boolean(input.trim() || pendingImage);

  function looksLikeHttpUrl(value: string): boolean {
    try {
      const u = new URL(value.trim());
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }

  async function fetchLinkAndExplain() {
    const url = input.trim();
    if (!looksLikeHttpUrl(url)) return;
    setLinkError(null);
    setLinkBusy(true);
    try {
      const res = await fetch('/api/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const body = (await res.json()) as {
        data?: { finalUrl: string; title: string; text: string; truncated: boolean };
        error?: string;
        code?: string;
      };
      if (!res.ok || !body.data) {
        setLinkError(body.error ?? `读取失败（${body.code ?? res.status}）`);
        return;
      }
      const { finalUrl, title, text, truncated } = body.data;
      const composed = `用户链接：${finalUrl}
标题：${title || '（无标题）'}

正文摘要${truncated ? '（已截断）' : ''}：
${text}

请用大白话解释这个页面/链接在讲啥。`;
      submitQuery(composed);
    } catch {
      setLinkError('读取链接失败，请稍后重试');
    } finally {
      setLinkBusy(false);
    }
  }

  const showFetchLink = looksLikeHttpUrl(input) && !pendingImage;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col">
      {/* Nav */}
      <header className="border-b border-zinc-800 px-4 sm:px-6 py-4 flex items-center justify-between gap-2 shrink-0">
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

      <main className="flex-1 flex flex-col items-center px-4 py-8 md:py-12 max-w-3xl mx-auto w-full min-w-0">
        {/* Hero */}
        {queries.length === 0 && (
          <div className="text-center mb-8 md:mb-10">
            <h1 className="text-3xl sm:text-4xl font-bold mb-3 px-1">
              这是<span className="text-orange-400">啥</span>？
            </h1>
            <p className="text-zinc-400 text-base leading-relaxed px-1">
              把任何让你头大的 AI 术语、新工具、震惊体新闻丢进来，用大白话告诉你这玩意儿是干嘛的。也可粘贴截图。
            </p>
          </div>
        )}

        {/* Input */}
        <div className="w-full">
          <div className="relative rounded-xl border border-zinc-700 bg-zinc-900 focus-within:border-orange-400 transition-colors">
            {pendingImage && (
              <div className="px-4 pt-3 flex items-start gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={pendingImage.previewUrl}
                  alt="待发送截图"
                  className="h-16 w-auto rounded-md border border-zinc-700 object-cover"
                />
                <button
                  type="button"
                  onClick={clearPendingImage}
                  className="text-xs text-zinc-500 hover:text-zinc-300 mt-1"
                >
                  移除截图
                </button>
              </div>
            )}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="粘贴文章标题、链接、截图，或者直接输入不懂的词..."
              rows={3}
              className="w-full min-w-0 bg-transparent resize-none rounded-xl px-4 pt-4 pb-14 md:pb-12 text-base md:text-sm text-zinc-100 placeholder:text-zinc-600 outline-none leading-relaxed"
            />
            <div className="absolute bottom-3 right-3 flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void attachImageFile(file);
                }}
              />
              {showFetchLink && (
                <button
                  type="button"
                  onClick={() => void fetchLinkAndExplain()}
                  disabled={linkBusy}
                  className="touch-manipulation text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-700 px-2.5 py-1.5 rounded-lg disabled:opacity-40"
                  title="服务端安全读取链接正文后再解释"
                >
                  {linkBusy ? '读取中…' : '读取链接'}
                </button>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="touch-manipulation text-xs text-zinc-500 hover:text-zinc-300 border border-zinc-700 px-2.5 py-1.5 rounded-lg"
                title="上传截图"
              >
                截图
              </button>
              {sendShortcutHint === null ? (
                <span className="text-xs text-zinc-600 tabular-nums" aria-hidden>
                  {'\u00a0'}
                </span>
              ) : sendShortcutHint ? (
                <span
                  className="text-xs text-zinc-600 tabular-nums"
                  data-testid="home-send-shortcut-hint"
                >
                  {sendShortcutHint}
                </span>
              ) : null}
              <button
                onClick={() => submitQuery(input)}
                disabled={!canSend}
                className="touch-manipulation bg-orange-500 hover:bg-orange-400 disabled:opacity-30 disabled:cursor-not-allowed text-white text-base md:text-sm font-semibold min-h-11 md:min-h-0 px-4 py-2 md:py-1.5 rounded-lg transition-colors"
              >
                这是啥？
              </button>
            </div>
          </div>
          {imageError && <p className="mt-2 text-xs text-red-400">{imageError}</p>}
          {linkError && <p className="mt-2 text-xs text-red-400">{linkError}</p>}

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
              image={q.image}
              onSaved={handleNotebookSave}
            />
          ))}
        </div>
      </main>
      <GuestMigrationModal accessToken={accessToken} />
    </div>
  );
}
