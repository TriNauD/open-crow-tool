/**
 * Debug-only: HTTPS 页面向 localhost ingest 会被混合内容拦截，经 SW 转发到 ingest。
 */
export function fabDebug(payload: {
  hypothesisId: string;
  location: string;
  message: string;
  data?: Record<string, unknown>;
}): void {
  // #region agent log
  try {
    chrome.runtime.sendMessage({
      type: 'CROW_DEBUG_FAB',
      payload: {
        sessionId: '821123',
        timestamp: Date.now(),
        runId: 'fab-debug',
        ...payload,
        data: payload.data ?? {},
      },
    });
  } catch {
    /* ignore */
  }
  // #endregion
}
