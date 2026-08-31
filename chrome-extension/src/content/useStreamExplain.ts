import { useState, useCallback, useEffect, useRef } from 'react';
import {
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

  /** 关闭当前解释流端口（重新点击 / reset 时用于中断上一轮） */
  const closeStream = useCallback(() => {
    try {
      portRef.current?.disconnect();
    } catch {
      /* already closed */
    }
    portRef.current = null;
  }, []);

  // 卡片关闭（hook 随组件卸载）时断开与 SW 的 Port，避免悬空连接与 SW 保活空转
  useEffect(() => {
    return () => {
      closeStream();
    };
  }, [closeStream]);

  const explain = useCallback(
    async (
      input: string,
      options?: { context?: string; surroundingText?: string }
    ) => {
      closeStream();
      setState({ text: '', isLoading: true, error: null, isDone: false, quotaOut: false });

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

      try {
        const port = chrome.runtime.connect({ name: 'crow-explain-proxy' });
        portRef.current = port;

        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          ...(userLlmHeader ? { [CROW_USER_LLM_HEADER]: userLlmHeader } : {}),
        };

        // 划词解释经命名端口转发到 background service worker：
        // SW 在 chrome-extension:// Origin 下 fetch，绕过后端 isOriginAllowed
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
