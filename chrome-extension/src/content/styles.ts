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
  /* 避让宿主划词气泡时的「选区下方」变体：去掉向上的位移 */
  .crow-btn.below { transform: translateX(-50%); }

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

  /* ── 追问树形索引（把手 + 左缘浮层；渲染在卡片元素之外，勿挪进 .crow-card） ── */
  .crow-tree-handle {
    position: fixed;
    z-index: 2147483647;
    background: #27272a;
    color: #a1a1aa;
    border: 1px solid #3f3f46;
    border-right: none;
    border-radius: 10px 0 0 10px;
    padding: 8px 8px;
    font-size: 11px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    white-space: nowrap;
    box-shadow: 0 2px 12px rgba(0,0,0,0.5);
    transition: background 0.15s, color 0.15s;
    pointer-events: auto;
  }
  .crow-tree-handle:hover {
    background: #3f3f46;
    color: #f4f4f5;
  }

  .crow-tree-panel {
    position: fixed;
    z-index: 2147483647;
    width: 224px;
    display: flex;
    flex-direction: column;
    background: #18181b;
    border: 1px solid #3f3f46;
    border-radius: 12px;
    box-shadow: 0 8px 40px rgba(0,0,0,0.7);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #f4f4f5;
    overflow: hidden;
    pointer-events: auto;
  }

  .crow-tree-panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid #27272a;
    font-size: 11px;
    font-weight: 700;
    color: #fb923c;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    flex-shrink: 0;
  }

  .crow-tree-panel-close {
    background: none;
    border: none;
    color: #71717a;
    cursor: pointer;
    font-size: 16px;
    line-height: 1;
    padding: 0 2px;
    transition: color 0.15s;
  }
  .crow-tree-panel-close:hover { color: #f4f4f5; }

  .crow-tree-panel-body {
    overflow-y: auto;
    padding: 6px;
    scrollbar-width: thin;
    scrollbar-color: #3f3f46 transparent;
  }
  .crow-tree-panel-body::-webkit-scrollbar { width: 6px; }
  .crow-tree-panel-body::-webkit-scrollbar-track { background: transparent; }
  .crow-tree-panel-body::-webkit-scrollbar-thumb {
    background: #3f3f46;
    border-radius: 3px;
  }

  .crow-tree-node {
    display: block;
    width: 100%;
    background: none;
    border: none;
    border-radius: 6px;
    color: #d4d4d8;
    cursor: pointer;
    font-family: inherit;
    font-size: 12px;
    line-height: 1.45;
    text-align: left;
    padding: 5px 8px;
    transition: background 0.15s, color 0.15s;
  }
  .crow-tree-node:hover {
    background: #27272a;
    color: #fafafa;
  }

  .crow-tree-node-text {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    word-break: break-word;
  }

  /* 跳转定位后的橙色高亮一瞬（outline 不影响布局，暗底/透明底通用） */
  @keyframes crow-index-flash-kf {
    0% {
      outline: 3px solid rgba(249, 115, 22, 0.95);
      outline-offset: -1px;
    }
    100% {
      outline: 3px solid rgba(249, 115, 22, 0);
      outline-offset: -1px;
    }
  }
  .crow-card.crow-index-flash {
    animation: crow-index-flash-kf 1.2s ease;
  }
  /* 子卡的 .crow-card 被重置为直角透明，高亮时补圆角让 outline 跟随包裹层视觉 */
  .crow-child-card .crow-card.crow-index-flash {
    border-radius: 12px;
  }
`;
