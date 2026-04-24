# Chrome 插件 — 开发日志

> Phase 2 | 开始：2026-04-24 | 完成：2026-04-24

## 变更记录

### 2026-04-24
- 初始化需求文档（plan / context / tasks）
- 新增 `lib/cors.ts`：CORS headers 常量 + OPTIONS 预检处理
- `app/api/explain/route.ts`：加 OPTIONS handler + CORS headers（streaming response）
- `app/api/notes/route.ts`：加 OPTIONS handler + CORS headers
- `app/api/notes/[id]/route.ts`：加 OPTIONS handler + CORS headers
- 新增 `chrome-extension/`：完整插件项目
  - `manifest.json`：MV3，双平台快捷键（Mac: Ctrl+Shift+W / Win: Alt+W）
  - `vite.config.ts`：@crxjs/vite-plugin@2.0.0 稳定版 + React
  - `src/content/index.tsx`：Shadow DOM 挂载入口
  - `src/content/App.tsx`：选词状态管理 + Alt+W 消息监听
  - `src/content/FloatingButton.tsx`：橙色浮动按钮，viewport 边界防溢出
  - `src/content/ExplainCard.tsx`：解释气泡卡片，流式输出，存入笔记本
  - `src/content/useStreamExplain.ts`：流式请求 hook（绝对 URL 版）
  - `src/content/styles.ts`：注入 Shadow DOM 的 CSS 字符串
  - `src/background/index.ts`：Alt+W 命令转发给 content script
  - `src/options/`：配置页（apiBaseUrl + adminSecret → chrome.storage.sync）
  - `src/popup/`：插件图标弹窗（配置状态提示 + 快捷键显示）
- 用户验收全部通过 ✅

## 遇到的问题与变更

### CORS 未部署导致插件请求失败
**问题**：插件点击橙色按钮后报"网炸了或者 AI 挂了"。
**原因**：CORS 改动（lib/cors.ts + 3个 API 路由）未推送，Vercel 运行的是旧代码，没有 `Access-Control-Allow-Origin` 头，浏览器拦截了 extension 的跨域请求。
**解决**：conditional signoff commit，推送 CORS 改动到 Vercel，等待重新部署。

### Mac 无 Alt 键，快捷键需双平台适配
**问题**：Mac 上 `Alt+W` 实际输入的是特殊字符 `∑`，快捷键无效。
**变更**：`manifest.json` 的 `suggested_key` 增加 `"mac": "MacCtrl+Shift+W"`（Ctrl+Shift+W）。Popup 显示文案根据 `navigator.platform` 自动切换。
**变更原因**：开发阶段仅考虑了 Windows 键位，实际测试时发现 Mac 不兼容。
**影响文件**：`chrome-extension/manifest.json`、`chrome-extension/src/popup/main.tsx`
**PRD 同步**：已更新 PRD § 二-模块B 触发方式描述。

## 关键架构决策

### Shadow DOM 样式隔离
content script 注入 Shadow DOM，CSS 字符串手动注入 shadow root，完全隔离页面样式污染。
host 元素 `pointer-events: none`，实际 UI 元素 `pointer-events: auto`。

### Web 端 Server Actions / 插件端 REST API 双轨
- Web 前端：Server Actions → lib/storage.ts → Supabase（ADMIN_SECRET 不出服务端）
- Chrome 插件：`/api/notes` REST + `x-admin-secret` header（外部客户端必须带 secret）
- 两者共享同一套 Supabase 数据，笔记本统一展示，来源用 source 字段区分
