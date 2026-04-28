import { describe, expect, it } from 'vitest';
import {
  shouldOmitKeyboardSendHintForUa,
  isAppleStyleShortcutHintForUa,
} from '@/lib/keyboard-send-hint';

describe('shouldOmitKeyboardSendHintForUa', () => {
  it('omit iPhone', () => {
    expect(
      shouldOmitKeyboardSendHintForUa(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      ),
    ).toBe(true);
  });

  it('omit Android Phone (Mobile)', () => {
    expect(
      shouldOmitKeyboardSendHintForUa(
        'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36',
      ),
    ).toBe(true);
  });

  it('does not omit Windows desktop Chrome', () => {
    expect(
      shouldOmitKeyboardSendHintForUa(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
      ),
    ).toBe(false);
  });

  it('does not omit macOS Safari', () => {
    expect(
      shouldOmitKeyboardSendHintForUa(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/17.0 Safari',
      ),
    ).toBe(false);
  });
});

describe('isAppleStyleShortcutHintForUa', () => {
  it('Mac + macOS UA → ⌘', () => {
    const ua =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari';
    expect(isAppleStyleShortcutHintForUa(ua, 'MacIntel')).toBe(true);
  });

  it('Win → Ctrl', () => {
    const ua =
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0';
    expect(isAppleStyleShortcutHintForUa(ua, 'Win32')).toBe(false);
  });
});
