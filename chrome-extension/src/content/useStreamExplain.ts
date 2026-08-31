import { useState, useCallback, useRef } from 'react';
import {
  CROW_USER_LLM_HEADER,
  encodeUserLlmConfigHeader,
  loadUserLlmConfig,
} from '../lib/user-llm-config';

export interface StreamState {
  text: string;
  isLoading: boolean;
  error: string | null;
  isDone: boolean;
  /** 今日免费额度已用完，本次使用免费模型（后台 SW 透传 x-crow-quota-out） */
  quotaOut?: boolean;
}

export function useStreamExplain(apiBaseUrl: string) {
  const [state, setState] = useState<StreamState>({
    text: '',
    isLoading: false,
    error: null,
    isDone: false,
  });

  const portRef = useRef<chrome.runtime.Port | null>(null);

  /** 关闭当前解释流端口（重新点击 / reset 时用于中断上一轮） */
  const closeStream = useCallback(() => {
    try {
      portRef.current?.disconnect();
    } catch {
      /* already closed */
    }
    portRef.current = null;
  }, []);

  const explain = useCallback(
    async (
      input: string,
      options?: { context?: string; surroundingText?: string }
    ) => {
      closeStream();
      setState({ text: '', isLoading: true, error: null, isDone: false, quotaOut: false });

      try {
        const body: {
          text: string;
          context?: string;
          surroundingText?: string;
        } = { text: input };
        if (options?.context) body.context = options.context;
        if (options?.surroundingText) body.surroundingText = options.surroundingText;

        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        const userCfg = await loadUserLlmConfig();
        if (userCfg) {
          headers[CROW_USER_LLM_HEADER] = encodeUserLlmConfigHeader(userCfg);
        }

        // 划词解释经命名端口转发到 background service worker：
        // SW 在 chrome-extension:// Origin 下 fetch，绕开后端 isOriginAllowed
        // 对第三方网页 Origin 的拒绝；流式分块经同一端口回传。
        await new Promise<void>((resolve) => {
          let finished = false;
          let receivedAny = false;

          const finish = () => {
            if (finished) return;
            finished = true;
            try {
              portRef.current?.disconnect();
            } catch {
              /* already closed */
            }
            portRef.current = null;
            resolve();
          };

          const port = chrome.runtime.connect({ name: 'explain-stream' });
          portRef.current = port;

          port.onMessage.addListener(
            (msg: { chunk?: string; error?: string; meta?: { quotaOut?: boolean } } | null) => {
              if (msg?.meta?.quotaOut) {
                setState((s) => ({ ...s, quotaOut: true }));
                return;
              }
              if (msg?.error) {
              receivedAny = true;
              setState((s) => ({ ...s, isLoading: false, isDone: true, error: msg.error }));
              finish();
            } else if (msg?.chunk) {
              receivedAny = true;
              setState((s) => ({ ...s, text: s.text + msg.chunk }));
            }
          });

          port.onDisconnect.addListener(() => {
            if (!finished) {
              setState((s) =>
                receivedAny
                  ? { ...s, isLoading: false, isDone: true }
                  : { ...s, isLoading: false, error: '网炸了或者 AI 挂了，稍后再试' }
              );
            }
            finish();
          });

          port.postMessage({ apiBaseUrl, body, headers });
        });
      } catch {
        setState((s) => ({
          ...s,
          isLoading: false,
          error: '网炸了或者 AI 挂了，稍后再试',
        }));
      }
    },
    [apiBaseUrl, closeStream]
  );

  const reset = useCallback(() => {
    closeStream();
    setState({ text: '', isLoading: false, error: null, isDone: false, quotaOut: false });
  }, [closeStream]);

  return { ...state, explain, reset };
}
