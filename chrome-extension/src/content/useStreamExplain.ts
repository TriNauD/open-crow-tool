import { useState, useCallback, useEffect, useRef } from 'react';
import {
  encodeUserLlmConfigHeader,
  loadUserLlmConfig,
  CROW_USER_LLM_HEADER,
} from '../lib/user-llm-config';

export interface StreamState {
  text: string;
  isLoading: boolean;
  error: string | null;
  isDone: boolean;
  /** 今日免费额度已用完，本次使用免费模型（后台 SW 透传 x-crow-quota-out） */
  quotaOut?: boolean;
  /** 解释完成时自动生成的总结 tag（如 TCP → 计算机网络）；未分类为 null */
  tag: string | null;
}

/** 解释完成后自动生成总结 tag；失败返回 null，保存时退化为未分类 */
async function fetchExtCategoryTag(
  apiBaseUrl: string,
  inputText: string,
  explanation: string
): Promise<string | null> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const userCfg = await loadUserLlmConfig();
    if (userCfg) headers[CROW_USER_LLM_HEADER] = encodeUserLlmConfigHeader(userCfg);
    const res = await fetch(`${apiBaseUrl.replace(/\/+$/, '')}/api/explain/tag`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ inputText, explanation }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { data?: { tag?: string | null } };
    return data.data?.tag ?? null;
  } catch {
    return null;
  }
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
    tag: null,
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
      setState({ text: '', isLoading: true, error: null, isDone: false, quotaOut: false, tag: null });

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

          let full = '';
          port.onMessage.addListener(
            (msg: { chunk?: string; done?: boolean; error?: string; meta?: { quotaOut?: boolean } } | null) => {
              if (msg?.meta?.quotaOut) {
                setState((s) => ({ ...s, quotaOut: true }));
                return;
              }
              if (msg?.error) {
              receivedAny = true;
              setState((s) => ({ ...s, isLoading: false, isDone: true, error: msg.error }));
              finish();
              } else if (msg?.done) {
                receivedAny = true;
                setState((s) => ({ ...s, isLoading: false, isDone: true }));
                // 解释完成：自动生成总结 tag（如 TCP → 计算机网络），失败不影响主流程
                void fetchExtCategoryTag(apiBaseUrl, input, full).then((t) => {
                  if (t) setState((s) => ({ ...s, tag: t }));
                });
                finish();
              } else if (msg?.chunk) {
                receivedAny = true;
                full += msg.chunk;
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
