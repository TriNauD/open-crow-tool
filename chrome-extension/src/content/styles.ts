export const STYLES = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  .crow-btn {
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
  .crow-btn:hover { background: #fb923c; }

  /* ── 卡片主体 ── */
  .crow-card {
    position: fixed;
    z-index: 2147483646;
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
    transition: box-shadow 0.2s;
  }

  .crow-card.pinned {
    z-index: 2147483647;
    box-shadow: 0 12px 48px rgba(0,0,0,0.8), 0 0 0 1px #fb923c33;
  }

  .crow-child-card .crow-card {
    position: static;
    width: 100%;
    max-height: none;
    border: none;
    border-radius: 0;
    box-shadow: none;
    background: transparent;
  }

  /* ── 顶部栏 ── */
  .crow-card-header {
    padding: 12px 14px 10px;
    border-bottom: 1px solid #27272a;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 8px;
    flex-shrink: 0;
    position: relative;
  }

  .crow-card-header.crow-draggable {
    cursor: grab;
  }
  .crow-card-header.crow-draggable:active {
    cursor: grabbing;
  }

  .crow-drag-handle {
    position: absolute;
    left: 2px;
    top: 50%;
    transform: translateY(-50%);
    font-size: 14px;
    color: #52525b;
    line-height: 1;
    user-select: none;
    pointer-events: none;
    letter-spacing: -2px;
    transition: color 0.15s;
  }
  .crow-card-header.crow-draggable:hover .crow-drag-handle {
    color: #71717a;
  }

  .crow-card-label {
    font-size: 11px;
    font-weight: 700;
    color: #fb923c;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 3px;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .crow-collapse-badge {
    background: #27272a;
    border: 1px solid #3f3f46;
    border-radius: 10px;
    padding: 1px 8px;
    font-size: 10px;
    font-weight: 600;
    color: #a1a1aa;
    cursor: pointer;
    text-transform: none;
    letter-spacing: 0;
    font-family: inherit;
    transition: background 0.15s, color 0.15s;
    white-space: nowrap;
  }
  .crow-collapse-badge:hover {
    background: #3f3f46;
    color: #f4f4f5;
  }

  .crow-card-query {
    font-size: 13px;
    color: #d4d4d8;
    line-height: 1.4;
    word-break: break-word;
  }

  .crow-header-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .crow-pin-btn {
    background: none;
    border: none;
    font-size: 14px;
    cursor: pointer;
    padding: 2px;
    line-height: 1;
    opacity: 0.5;
    transition: opacity 0.15s;
  }
  .crow-pin-btn:hover { opacity: 1; }
  .crow-pin-btn.active { opacity: 1; }

  .crow-close {
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
  .crow-close:hover { color: #f4f4f5; }

  /* ── 内容区 ── */
  .crow-card-body {
    padding: 12px 14px;
    overflow-y: auto;
    flex: 1;
    font-size: 14px;
    line-height: 1.65;
    color: #f4f4f5;
    word-break: break-word;
    scrollbar-width: thin;
    scrollbar-color: #3f3f46 transparent;
    position: relative;
  }

  .crow-card-body.collapsed {
    display: none;
  }

  .crow-card-body::-webkit-scrollbar {
    width: 6px;
  }
  .crow-card-body::-webkit-scrollbar-track {
    background: transparent;
  }
  .crow-card-body::-webkit-scrollbar-thumb {
    background: #3f3f46;
    border-radius: 3px;
  }
  .crow-card-body::-webkit-scrollbar-thumb:hover {
    background: #52525b;
  }

  /* ── 滚动箭头 ── */
  .crow-scroll-arrows {
    position: absolute;
    right: 8px;
    bottom: 40px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    z-index: 10;
    pointer-events: auto;
  }

  .crow-scroll-arrow {
    width: 24px;
    height: 24px;
    border-radius: 6px;
    border: 1px solid #3f3f46;
    background: #27272a;
    color: #a1a1aa;
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, color 0.15s;
    pointer-events: auto;
  }
  .crow-scroll-arrow:hover:not(:disabled) {
    background: #3f3f46;
    color: #f4f4f5;
  }
  .crow-scroll-arrow:disabled {
    opacity: 0.25;
    cursor: default;
  }

  /* ── 加载 / 动画 ── */
  .crow-loading {
    display: flex;
    align-items: center;
    gap: 5px;
    color: #71717a;
    font-size: 13px;
  }

  @keyframes crow-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.25; }
  }

  .crow-dot {
    width: 6px;
    height: 6px;
    background: #fb923c;
    border-radius: 50%;
    animation: crow-pulse 1.2s ease infinite;
  }
  .crow-dot:nth-child(2) { animation-delay: 0.2s; }
  .crow-dot:nth-child(3) { animation-delay: 0.4s; }

  @keyframes crow-blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0; }
  }

  .crow-cursor {
    display: inline-block;
    width: 2px;
    height: 14px;
    background: #fb923c;
    margin-left: 2px;
    vertical-align: middle;
    animation: crow-blink 0.9s ease infinite;
  }

  .crow-error { color: #f87171; font-size: 13px; }

  /* ── 底部操作栏 ── */
  .crow-card-footer {
    padding: 9px 14px;
    border-top: 1px solid #27272a;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .crow-save-btn {
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
  .crow-save-btn:hover:not(:disabled) { color: #d4d4d8; }
  .crow-save-btn.saved { color: #4ade80; text-decoration: none; cursor: default; }

  .crow-sep { color: #3f3f46; font-size: 12px; }

  .crow-hint { font-size: 12px; color: #52525b; }

  /* ── 追问输入框 ── */
  .crow-followup {
    padding: 8px 14px 10px;
    border-top: 1px solid #27272a;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .crow-followup-input {
    flex: 1;
    min-width: 0;
    background: #27272a;
    border: 1px solid #3f3f46;
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 12px;
    color: #f4f4f5;
    font-family: inherit;
    outline: none;
    transition: border-color 0.15s;
  }
  .crow-followup-input::placeholder { color: #52525b; }
  .crow-followup-input:focus { border-color: #fb923c; }

  .crow-followup-btn {
    flex-shrink: 0;
    background: #f97316;
    color: #fff;
    border: none;
    border-radius: 6px;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: background 0.15s;
  }
  .crow-followup-btn:hover:not(:disabled) { background: #fb923c; }
  .crow-followup-btn:disabled { opacity: 0.4; cursor: default; }

  /* ── 子卡片容器 ── */
  .crow-child-card {
    margin-top: 10px;
    border: 1px solid #3f3f46;
    border-radius: 12px;
    background: #1a1a1e;
    overflow: hidden;
  }
`;
