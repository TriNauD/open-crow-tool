'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useStreamExplain } from '@/hooks/useStreamExplain';
import { saveNoteAction } from '@/app/actions';
import { cn } from '@/lib/utils/cn';

interface SelectionPopoverState {
  text: string;
  x: number;
  y: number;
}

interface ExplanationCardProps {
  inputText: string;
  context?: string;         // parent explanation text for recursive context
  depth?: number;           // nesting depth, caps the recursion visually
  onSaved?: () => void;
}

export default function ExplanationCard({
  inputText,
  context,
  depth = 0,
  onSaved,
}: ExplanationCardProps) {
  const { text, isLoading, error, isDone, explain } = useStreamExplain();
  const [popover, setPopover] = useState<SelectionPopoverState | null>(null);
  const [children, setChildren] = useState<{ id: string; text: string }[]>([]);
  const [savedId, setSavedId] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Kick off explanation on mount
  useEffect(() => {
    explain(inputText, context);
  }, [inputText, context, explain]);

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

  const handleSave = useCallback(async () => {
    if (!text) return;
    try {
      const entry = await saveNoteAction({
        inputText,
        explanation: text,
        parentText: context,
        source: 'web',
      });
      setSavedId(entry.id);
      onSaved?.();
    } catch (err) {
      console.error('Failed to save note', err);
    }
  }, [text, inputText, context, onSaved]);

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
          {depth === 0 ? '这他妈是啥？' : '这他妈又是啥？'}
        </span>
        <p className="text-sm text-zinc-300 leading-relaxed select-text">{inputText}</p>
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
          这他妈又是啥？
        </button>
      )}

      {/* Actions */}
      {isDone && text && (
        <div className="mt-4 flex items-center gap-3">
          {savedId ? (
            <span className="text-xs text-green-400">已存到笔记本</span>
          ) : (
            <button
              onClick={handleSave}
              className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors underline underline-offset-2"
            >
              存到笔记本
            </button>
          )}
          <span className="text-zinc-700 text-xs">·</span>
          <span className="text-xs text-zinc-600">选中文字可以继续追问</span>
        </div>
      )}

      {/* Recursive child explanations */}
      {children.map((child) => (
        <ExplanationCard
          key={child.id}
          inputText={child.text}
          context={text}
          depth={depth + 1}
          onSaved={onSaved}
        />
      ))}
    </div>
  );
}
