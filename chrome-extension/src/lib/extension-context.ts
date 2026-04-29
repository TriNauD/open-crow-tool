/**
 * After MV3 extension reload/update, injected content scripts keep running but
 * any chrome.* access throws "Extension context invalidated".
 */

export function isExtensionContextInvalidatedError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return msg.includes('Extension context invalidated');
}

/** Run sync code; swallow only invalidated-extension errors. */
export function ignoreIfContextInvalidated(fn: () => void): void {
  try {
    fn();
  } catch (e) {
    if (!isExtensionContextInvalidatedError(e)) throw e;
  }
}

/** Best-effort: runtime.id is undefined / invalid after context teardown. */
export function extensionContextLikelyOk(): boolean {
  try {
    return Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}
