export const STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .wtf-btn {
    position: fixed;
    z-index: 2147483647;
    background: #f97316;
    color: #fff;
    border: none;
    border-radius: 20px;
    padding: 5px 14px;
    font-size: 13px;
    font-weight: 600;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    cursor: pointer;
    white-space: nowrap;
    box-shadow: 0 2px 12px rgba(0,0,0,0.5);
    transform: translateX(-50%) translateY(calc(-100% - 6px));
    transition: background 0.15s;
    pointer-events: auto;
  }
  .wtf-btn:hover { background: #fb923c; }

  .wtf-card {
    position: fixed;
    z-index: 2147483647;
    width: 360px;
    max-width: calc(100vw - 24px);
    max-height: 480px;
    background: #18181b;
    border: 1px solid #3f3f46;
    border-radius: 16px;
    box-shadow: 0 8px 40px rgba(0,0,0,0.7);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #f4f4f5;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    pointer-events: auto;
  }

  .wtf-card-header {
    padding: 12px 14px 10px;
    border-bottom: 1px solid #27272a;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    flex-shrink: 0;
  }

  .wtf-card-label {
    font-size: 11px;
    font-weight: 700;
    color: #fb923c;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 3px;
  }

  .wtf-card-query {
    font-size: 13px;
    color: #d4d4d8;
    line-height: 1.4;
    word-break: break-word;
  }

  .wtf-close {
    flex-shrink: 0;
    background: none;
    border: none;
    color: #71717a;
    cursor: pointer;
    font-size: 20px;
    line-height: 1;
    padding: 0 2px;
    margin-top: -2px;
    transition: color 0.15s;
  }
  .wtf-close:hover { color: #f4f4f5; }

  .wtf-card-body {
    padding: 12px 14px;
    overflow-y: auto;
    flex: 1;
    font-size: 14px;
    line-height: 1.65;
    color: #f4f4f5;
    word-break: break-word;
  }

  .wtf-loading {
    display: flex;
    align-items: center;
    gap: 5px;
    color: #71717a;
    font-size: 13px;
  }

  @keyframes wtf-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.25; }
  }

  .wtf-dot {
    width: 6px;
    height: 6px;
    background: #fb923c;
    border-radius: 50%;
    animation: wtf-pulse 1.2s ease infinite;
  }
  .wtf-dot:nth-child(2) { animation-delay: 0.2s; }
  .wtf-dot:nth-child(3) { animation-delay: 0.4s; }

  @keyframes wtf-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }

  .wtf-cursor {
    display: inline-block;
    width: 2px;
    height: 14px;
    background: #fb923c;
    margin-left: 2px;
    vertical-align: middle;
    animation: wtf-blink 0.9s ease infinite;
  }

  .wtf-error { color: #f87171; font-size: 13px; }

  .wtf-card-footer {
    padding: 9px 14px;
    border-top: 1px solid #27272a;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .wtf-save-btn {
    background: none;
    border: none;
    font-size: 12px;
    color: #71717a;
    cursor: pointer;
    text-decoration: underline;
    text-underline-offset: 2px;
    font-family: inherit;
    transition: color 0.15s;
  }
  .wtf-save-btn:hover:not(:disabled) { color: #d4d4d8; }
  .wtf-save-btn.saved { color: #4ade80; text-decoration: none; cursor: default; }

  .wtf-sep { color: #3f3f46; font-size: 12px; }

  .wtf-hint { font-size: 12px; color: #52525b; }
`;
