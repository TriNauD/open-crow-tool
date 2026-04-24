'use client';

import { useState, useCallback, useRef } from 'react';

export interface ExplainState {
  text: string;
  isLoading: boolean;
  error: string | null;
  isDone: boolean;
}

export function useStreamExplain() {
  const [state, setState] = useState<ExplainState>({
    text: '',
    isLoading: false,
    error: null,
    isDone: false,
  });

  const abortRef = useRef<AbortController | null>(null);

  const explain = useCallback(async (input: string, context?: string) => {
    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ text: '', isLoading: true, error: null, isDone: false });

    try {
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input, context }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const msg = await res.text();
        setState((s) => ({ ...s, isLoading: false, error: msg || '请求失败了' }));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setState((s) => ({ ...s, text: s.text + chunk }));
      }

      setState((s) => ({ ...s, isLoading: false, isDone: true }));
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setState((s) => ({
        ...s,
        isLoading: false,
        error: '网炸了或者 AI 挂了，稍后再试',
      }));
    }
  }, []);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState({ text: '', isLoading: false, error: null, isDone: false });
  }, []);

  return { ...state, explain, reset };
}
