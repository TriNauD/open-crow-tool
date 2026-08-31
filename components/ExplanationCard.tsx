'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useStreamExplain, type ExplainImage } from '@/hooks/useStreamExplain';
import { useAuthSession } from '@/hooks/useAuthSession';
import { createNote, fetchNotes, replaceNote } from '@/lib/api/notes-client';
import { saveGuestNote, getGuestNotes, removeGuestNote } from '@/lib/guest-notes';
import { DuplicateNoteModal } from '@/components/DuplicateNoteModal';
import type { NoteEntry } from '@/lib/db/notes';
import { normalizeNoteInput } from '@/lib/notes/normalize-input';
import { cn } from '@/lib/utils/cn';

interface SelectionPopoverState {
  text: string;
  x: number;
  y: number;
}

/** 一轮历史：问题 + 当时的回答（追加式，从主问题开始） */
export interface FollowUpTurn {
  question: string;
  explanation: string;
}

interface ExplanationCardProps {
  inputText: string;
  /** 可选截图（MVP 不存原图，保存笔记用文字占位） */
  image?: ExplainImage;
  context?: string;         // parent explanation text for recursive context
  /** 祖先轮的问答链（不含本轮）；发请求时组装成整条对话记录 */
  history?: FollowUpTurn[];
  depth?: number;           // nesting depth, caps the recursion visually
  onSaved?: () => void;
}

export default function ExplanationCard({
  inputText,
  image,
  context,
  history,
  depth = 0,
  onSaved,
}: ExplanationCardProps) {
  const { text, isLoading, error, isDone, explain, quotaOut } = useStreamExplain();
  const { accessToken } = useAuthSession();
  const [popover, setPopover] = useState<SelectionPopoverState | null>(null);
  const [children, setChildren] = useState<{ id: string; text: string }[]>([]);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [savedMode, setSavedMode] = useState<'cloud' | 'guest' | null>(null);
  const [duplicateNote, setDuplicateNote] = useState<NoteEntry | null>(null);
  const [savePending, setSavePending] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [followUpText, setFollowUpText] = useState('');
  const cardRef = useRef<HTMLDivElement>(null);

  const noteInputText = image
    ? inputText.trim()
      ? `（图片）${inputText.trim()}`
      : '（图片说明）'
    : inputText;

  // 带整条链时组装成对话记录；无历史则不发 context（主卡片之间互不共享）
  const transcriptContext = history?.length
    ? history
        .map(
          (t, i) =>
            `第 ${i + 1} 轮问答：\n问：「${t.question}」\n答：「${t.explanation}」`
        )
        .join('\n\n')
    : undefined;

  // Kick off explanation on mount
  useEffect(() => {
    explain(inputText, transcriptContext ? { context: transcriptContext, image } : { image });
  }, [inputText, transcriptContext, image, explain]);

  // Track text selection inside this card (input text + result area both supported).
  // stopPropagation ensures only the innermost card reacts when cards are nested.
  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();

    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setPopover(null);
      return;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText) {
      setPopover(null);
      return;
    }

    const range = selection.getRangeAt(0);
    if (!cardRef.current?.contains(range.commonAncestorContainer)) {
      return;
    }

    const rect = range.getBoundingClientRect();
    const containerRect = cardRef.current.getBoundingClientRect();

    setPopover({
      text: selectedText,
      x: rect.left - containerRect.left + rect.width / 2,
      y: rect.top - containerRect.top - 8,
    });
  }, []);

  const handleDrillDown = useCallback(() => {
    if (!popover) return;
    setChildren((prev) => [...prev, { id: crypto.randomUUID(), text: popover.text }]);
    setPopover(null);
    window.getSelection()?.removeAllRanges();
  }, [popover]);

  /** 手动追问：与划词钻取共用同一子卡片通道，带当前解释作 context */
  const handleFollowUpSubmit = useCallback(() => {
    const q = followUpText.trim();
    if (!q) return;
    setChildren((prev) => [...prev, { id: crypto.randomUUID(), text: q }]);
    setFollowUpText('');
    setFollowUpOpen(false);
  }, [followUpText]);

  const normalizedInput = normalizeNoteInput(noteInputText);

  // Only check for duplicates on top-level notes (depth === 0, no parent context)
  const shouldCheckDuplicate = depth === 0 && !context;

  function findGuestDuplicate(): NoteEntry | null {
    if (!shouldCheckDuplicate) return null;
    const match = getGuestNotes().find(
      (n) => normalizeNoteInput(n.inputText) === normalizedInput
    );
    if (!match) return null;
    return {
      id: match.clientNoteId,
      user_id: 'guest',
      inputText: match.inputText,
      explanation: match.explanation,
      parentText: match.parentText,
      source: match.source,
      savedAt: match.savedAt,
      tags: match.tags ?? [],
    };
  }

  async function findCloudDuplicate(): Promise<NoteEntry | null> {
    if (!accessToken || !shouldCheckDuplicate) return null;
    // 用 GET /api/notes?q= 做候选集，再在本地做标准化后精确比；同题变体若与 ilike 搜索错位，后续再改后端或专用接口，避免拉全量。
    const notes = await fetchNotes(accessToken, noteInputText.trim());
    return (
      notes.find(
        (n) => normalizeNoteInput(n.inputText) === normalizedInput && !n.parentText
      ) ?? null
    );
  }

  const handleSave = useCallback(async () => {
    if (!text) return;
    setSavePending(true);
    try {
      if (accessToken) {
        const existing = await findCloudDuplicate();
        if (existing) {
          setDuplicateNote(existing);
          return;
        }
        const entry = await createNote(accessToken, {
          inputText: noteInputText,
          explanation: text,
          parentText: context,
          source: 'web',
        });
        setSavedId(entry.id);
        setSavedMode('cloud');
      } else {
        const existing = findGuestDuplicate();
        if (existing) {
          setDuplicateNote(existing);
          return;
        }
        const clientNoteId = crypto.randomUUID();
        saveGuestNote({
          clientNoteId,
          inputText: noteInputText,
          explanation: text,
          parentText: context,
          source: 'web',
          savedAt: Date.now(),
        });
        setSavedId(clientNoteId);
        setSavedMode('guest');
      }
      onSaved?.();
    } catch (err) {
      console.error('Failed to save note', err);
    } finally {
      setSavePending(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, accessToken, noteInputText, context, onSaved, normalizedInput, shouldCheckDuplicate]);

  const handleKeepBoth = useCallback(async () => {
    if (!text) return;
    setSavePending(true);
    try {
      if (accessToken) {
        const entry = await createNote(accessToken, {
          inputText: noteInputText,
          explanation: text,
          parentText: context,
          source: 'web',
        });
        setSavedId(entry.id);
        setSavedMode('cloud');
      } else {
        const clientNoteId = crypto.randomUUID();
        saveGuestNote({
          clientNoteId,
          inputText: noteInputText,
          explanation: text,
          parentText: context,
          source: 'web',
          savedAt: Date.now(),
        });
        setSavedId(clientNoteId);
        setSavedMode('guest');
      }
      setDuplicateNote(null);
      onSaved?.();
    } catch (err) {
      console.error('Failed to save note', err);
    } finally {
      setSavePending(false);
    }
  }, [text, accessToken, noteInputText, context, onSaved]);

  const handleReplace = useCallback(async () => {
    if (!text || !duplicateNote) return;
    setSavePending(true);
    try {
      if (accessToken) {
        const entry = await replaceNote(accessToken, duplicateNote.id, {
          inputText: noteInputText,
          explanation: text,
          parentText: context,
          source: 'web',
        });
        setSavedId(entry.id);
        setSavedMode('cloud');
      } else {
        removeGuestNote(duplicateNote.id);
        const clientNoteId = crypto.randomUUID();
        saveGuestNote({
          clientNoteId,
          inputText: noteInputText,
          explanation: text,
          parentText: context,
          source: 'web',
          savedAt: Date.now(),
        });
        setSavedId(clientNoteId);
        setSavedMode('guest');
      }
      setDuplicateNote(null);
      onSaved?.();
    } catch (err) {
      console.error('Failed to replace note', err);
    } finally {
      setSavePending(false);
    }
  }, [text, accessToken, noteInputText, context, duplicateNote, onSaved]);

  const depthColors = [
    'border-zinc-800 bg-zinc-950',
    'border-zinc-700 bg-zinc-900',
    'border-zinc-600 bg-zinc-850',
  ];
  const borderClass = depthColors[Math.min(depth, depthColors.length - 1)];

  return (
    <div
      ref={cardRef}
      onMouseUp={handleMouseUp}
      className={cn(
        'relative rounded-xl border p-5',
        depth > 0 && 'mt-3 ml-4',
        borderClass
      )}
    >
      {/* Query label — also selectable for drill-down */}
      <div className="mb-3 flex items-start gap-2">
        <span className="mt-0.5 shrink-0 text-xs font-semibold text-orange-400 uppercase tracking-wide">
          {depth === 0 ? '这是啥？' : '这又是啥？'}
        </span>
        <p className="text-sm text-zinc-300 leading-relaxed select-text">
          {image ? (
            <>
              <span className="text-emerald-400/80 mr-1">[截图]</span>
              {inputText.trim() || '（看图解释）'}
            </>
          ) : (
            inputText
          )}
        </p>
      </div>

      {/* Result area */}
      <div className="relative select-text">
        {isLoading && !text && (
          <div className="flex items-center gap-2 text-zinc-500 text-sm">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse" />
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse delay-150" />
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse delay-300" />
            <span>正在思考中...</span>
          </div>
        )}

        {error && (
          <p className="text-red-400 text-sm">{error}</p>
        )}

        {text && (
          <p className="text-zinc-100 text-base leading-relaxed whitespace-pre-wrap">
            {text}
            {isLoading && (
              <span className="inline-block w-0.5 h-4 bg-orange-400 animate-pulse ml-0.5 align-middle" />
            )}
          </p>
        )}
      </div>

      {/* Selection popover — at card level, covers both input and result areas.
          onMouseDown preventDefault keeps the text selection alive when clicking. */}
      {popover && (
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleDrillDown}
          className="absolute z-10 -translate-x-1/2 -translate-y-full bg-orange-500 hover:bg-orange-400 text-white text-xs font-semibold px-3 py-1.5 rounded-full shadow-lg whitespace-nowrap transition-colors"
          style={{ left: popover.x, top: popover.y }}
        >
          这又是啥？
        </button>
      )}

      {/* 今日预算用完的降级提示 */}
      {quotaOut && isDone && (
        <p className="mt-2 text-xs text-amber-500/90">
          今日免费额度已用完，本次使用免费模型生成
        </p>
      )}

      {/* Actions */}
      {isDone && text && (
        <div className="mt-4 flex items-center gap-3">
          {savedId ? (
            <span className="text-xs text-green-400">
              {savedMode === 'guest' ? '已存为游客笔记（登录后可迁移）' : '已存到笔记本'}
            </span>
          ) : (
            <button
              onClick={handleSave}
              disabled={savePending}
              className="text-xs text-zinc-500 hover:text-zinc-300 disabled:opacity-40 transition-colors underline underline-offset-2"
            >
              {savePending ? '检查中...' : '存到笔记本'}
            </button>
          )}
          <span className="text-zinc-700 text-xs">·</span>
          <button
            onClick={() => setFollowUpOpen((v) => !v)}
            className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors underline underline-offset-2"
          >
            {followUpOpen ? '收起追问' : '追问'}
          </button>
          <span className="text-xs text-zinc-600">选中文字也可以继续追问</span>
        </div>
      )}

      {/* 追问输入框：默认隐藏，点「追问」后出现，提交后生成子卡片 */}
      {followUpOpen && (
        <div className="mt-3 flex items-center gap-2">
          <input
            autoFocus
            aria-label="追问问题"
            value={followUpText}
            onChange={(e) => setFollowUpText(e.target.value)}
            onKeyDown={(e) => {
              // 中文输入法组词过程中的回车不提交，避免误触发
              if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
              handleFollowUpSubmit();
            }}
            placeholder="输入你想追问的问题，回车发送"
            className="flex-1 min-w-0 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-orange-400"
          />
          <button
            onClick={handleFollowUpSubmit}
            disabled={!followUpText.trim()}
            className="shrink-0 rounded-md bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white text-xs font-semibold px-3 py-1.5 transition-colors"
          >
            发送
          </button>
        </div>
      )}

      {/* Duplicate detection modal */}
      {duplicateNote && text && (
        <DuplicateNoteModal
          existing={duplicateNote}
          newExplanation={text}
          onKeepBoth={handleKeepBoth}
          onReplace={handleReplace}
          pending={savePending}
        />
      )}

      {/* Recursive child explanations */}
      {children.map((child) => (
        <ExplanationCard
          key={child.id}
          inputText={child.text}
          context={text}
          history={[
            ...(history ?? []),
            { question: noteInputText, explanation: text },
          ]}
          depth={depth + 1}
          onSaved={onSaved}
        />
      ))}
    </div>
  );
}
