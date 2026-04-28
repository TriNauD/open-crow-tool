/**
 * 首页「发送」快捷键角标文案。手机浏览器不展示（无统一物理键盘预期）。
 * 仅应在客户端 `useEffect` 内调用。
 */

/** 纯函数，便于单测 */
export function shouldOmitKeyboardSendHintForUa(ua: string): boolean {
  if (/iPhone|iPod/i.test(ua)) return true;
  if (/Android/i.test(ua) && /\bMobile\b/i.test(ua)) return true;
  return /webOS|BlackBerry|IEMobile|Opera Mini|Opera Mobi/i.test(ua);
}

/** 是否显示 ⌘ 风格（相对 Ctrl）；基于 UA + platform，排除已单独处理的 phone UA */
export function isAppleStyleShortcutHintForUa(ua: string, platform: string): boolean {
  if (/iPhone|iPod/i.test(ua)) return false;
  return /Mac|iPad/i.test(platform) || /Mac OS/i.test(ua);
}

export type KeyboardSendHintLabel = '' | '⌘↵ 发送' | 'Ctrl+Enter 发送';

export function getKeyboardSendShortcutHintLabel(): KeyboardSendHintLabel {
  if (typeof navigator === 'undefined') return '';
  const ua = navigator.userAgent;
  if (shouldOmitKeyboardSendHintForUa(ua)) return '';
  if (isAppleStyleShortcutHintForUa(ua, navigator.platform)) {
    return '⌘↵ 发送';
  }
  return 'Ctrl+Enter 发送';
}
