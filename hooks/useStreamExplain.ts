'use client';

import { useState, useCallback, useRef } from 'react';
import {
  USER_LLM_CONFIG_HEADER,
  encodeUserLLMConfigHeader,
  loadStoredUserLLMConfig,
} from '@/lib/user-llm-config';

export interface ExplainState {
  text: string;
  isLoading: boolean;
  error: string | null;
  isDone: boolean;
}

export type ExplainImage = {
  mimeType: string;
  dataBase64: string;
};

export type ExplainRequestOptions = {
  context?: string;
  image?: ExplainImage;
};

export function useStreamExplain() {
  const [state, setState] = useState<ExplainState>({
    text: '',
    isLoading: false,
    error: null,
    isDone: false,
  });

  const abortRef = useRef<AbortController | null>(null);
  /** 最近一次请求的入参，供失败后「重试」原样重发 */
  const lastRequestRef = useRef<{ input: string; options?: ExplainRequestOptions } | null>(null);

  const explain = useCallback(
    async (input: string, contextOrOptions?: string | ExplainRequestOptions) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setState({ text: '', isLoading: true, error: null, isDone: false });

      const options: ExplainRequestOptions =
        typeof contextOrOptions === 'string'
          ? { context: contextOrOptions }
          : (contextOrOptions ?? {});
      lastRequestRef.current = { input, options };

      try {
        const body: {
          text: string;
          context?: string;
          image?: ExplainImage;
        } = { text: input };
        if (options.context) body.context = options.context;
        if (options.image) body.image = options.image;

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const userCfg = loadStoredUserLLMConfig();
        if (userCfg) {
          headers[USER_LLM_CONFIG_HEADER] = encodeUserLLMConfigHeader(userCfg);
        }

        const res = await fetch('/api/explain', {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
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
    },
    []
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setState({ text: '', isLoading: false, error: null, isDone: false });
  }, []);

  /** 失败后原样重发最近一次请求 */
  const retry = useCallback(() => {
    const last = lastRequestRef.current;
    if (!last) return;
    return explain(last.input, last.options);
  }, [explain]);

  return { ...state, explain, retry, reset };
}
