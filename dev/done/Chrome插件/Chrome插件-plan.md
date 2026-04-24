# Chrome 插件 — 开发计划

> Phase 2 | 开始时间：2026-04-24

## 目标
在任意网页划词，原地弹出 AI 解释气泡卡片，一键存入云端笔记本。

## 架构

```
用户选词 / 按 Alt+W
    ↓
content script（Shadow DOM + React）
    ├── FloatingButton（定位在选词旁边）
    └── ExplainCard（气泡卡片）
            ├── fetch streaming → what-the-f-tool.vercel.app/api/explain
            └── 存入笔记本 → /api/notes（带 x-admin-secret header）

Alt+W 快捷键 → background service worker → postMessage → content script
```

## 构建方案
- 框架：Vite 5 + @crxjs/vite-plugin@2.0.0-beta.26 + React 18
- 样式：Shadow DOM 内注入原生 CSS 字符串（不用 Tailwind，bundle 更小）
- Manifest V3

## 目录结构
```
chrome-extension/
  manifest.json
  package.json
  vite.config.ts
  tsconfig.json
  src/
    content/
      index.tsx         ← 挂载 Shadow DOM
      App.tsx           ← 管理选词/解释状态
      FloatingButton.tsx
      ExplainCard.tsx
      useStreamExplain.ts
      styles.ts         ← CSS 字符串
    background/
      index.ts          ← 处理 Alt+W 命令
    options/
      index.html
      main.tsx
      Options.tsx       ← 填写 apiBaseUrl + adminSecret
    popup/
      index.html
      main.tsx
```

## Web 端改动（必须同步）
- 新增 `lib/cors.ts`：CORS headers 常量 + OPTIONS 预检处理
- `app/api/explain/route.ts`：加 OPTIONS handler + CORS headers
- `app/api/notes/route.ts`：加 OPTIONS handler + CORS headers
- `app/api/notes/[id]/route.ts`：加 OPTIONS handler + CORS headers

原因：content script 发跨域请求，服务端必须返回 CORS 响应头。
