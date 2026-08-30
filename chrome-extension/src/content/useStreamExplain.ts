import { useState, useCallback, useRef } from 'react';
import {
  encodeUserLlmConfigHeader,
  loadUserLlmConfig,
} from '../lib/user-llm-config';

export interface StreamState {
  text: string;
  isLoading: boolean;
  error: string | null;
  isDone: boolean;
}

/**
 * 解释请求经 background SW 转发（流式 Port）：
 * 第三方页面直连 /api/explain 的 Origin 是网页 origin，会被站点护栏 403；
 * SW 发起的请求 Origin 为 chrome-extension://，被放行。
 * 用户自配 LLM 头（x-crow-llm-config）一并经 SW 透传。
 * chrome.runtime 不可用（扩展重载中）时报错提示，不再尝试直连。
 */
export function useStreamExplain(apiBaseUrl: string) {
  const [state, setState] = useState<StreamState>({
    text: '',
    isLoading: false,
    error: null,
    isDone: false,
  });

  const portRef = useRef<chrome.runtime.Port | null>(null);

  const explain = useCallback(
    async (
      input: string,
      options?: { context?: string; surroundingText?: string }
    ) => {
      portRef.current?.disconnect();
      setState({ text: '', isLoading: true, error: null, isDone: false });

      if (typeof chrome === 'undefined' || !chrome.runtime?.connect) {
        setState((s) => ({
          ...s,
          isLoading: false,
          error: '插件上下文已失效，请刷新页面后重试',
        }));
        return;
      }

      const body: {
        text: string;
        context?: string;
        surroundingText?: string;
      } = { text: input };
      if (options?.context) body.context = options.context;
      if (options?.surroundingText) body.surroundingText = options.surroundingText;

      const userCfg = await loadUserLlmConfig();
      const userLlmHeader = userCfg ? encodeUserLlmConfigHeader(userCfg) : '';

      let settled = false;

      try {
        const port = chrome.runtime.connect({ name: 'crow-explain-proxy' });
        portRef.current = port;

        port.onMessage.addListener((msg: unknown) => {
          const m = msg as { chunk?: string; done?: boolean; error?: string; ping?: boolean };
          if (m.ping) return;
          if (m.chunk) {
            setState((s) => ({ ...s, text: s.text + m.chunk }));
          }
          if (m.error) {
            settled = true;
            setState((s) => ({ ...s, isLoading: false, error: m.error! }));
            port.disconnect();
            return;
          }
          if (m.done) {
            settled = true;
            setState((s) => ({ ...s, isLoading: false, isDone: true }));
          }
        });

        port.onDisconnect.addListener(() => {
          if (!settled) {
            setState((s) => ({
              ...s,
              isLoading: false,
              error: '与插件的连接中断了，请重试',
            }));
          }
        });

        port.postMessage({ apiBaseUrl, body, userLlmHeader });
      } catch {
        setState((s) => ({
          ...s,
          isLoading: false,
          error: '网炸了或者 AI 挂了，稍后再试',
        }));
      }
    },
    [apiBaseUrl]
  );

  const reset = useCallback(() => {
    portRef.current?.disconnect();
    setState({ text: '', isLoading: false, error: null, isDone: false });
  }, []);

  return { ...state, explain, reset };
}
