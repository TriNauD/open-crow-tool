# Chrome 划词插件（模块 B，Phase 2 核心）

> 原 PRD「二、三大功能模块 → 模块 B」

用户在任意网页（重点：X、GitHub、技术博客）划词，原地弹出 AI 解释气泡卡片，无需切换标签页。

**触发方式（已确认）：**
- 选中文字 → 自动出现橙色浮动按钮
- 同时支持键盘快捷键：Windows/Linux `Alt+W`，Mac `Ctrl+Shift+W`

**弹出卡片位置（已确认）：**
- 悬浮在选中文字旁边（就近显示）

**卡片功能：**
- 流式显示 AI 解释（复用 `/api/explain` 接口）
- 卡片内可再次划词递归追问
- 一键"存入笔记本"（同步到云端，与 Web 端共享）
- 支持关闭卡片（点击外部区域 / 按 Esc）

**鉴权（与多用户笔记本对齐，2026-04-27 ✅）：**
- 用户在 **Web 端登录** 后，导航栏点 **「连接插件」**；网站通过 `postMessage` 将 `accessToken` 与自洽的 `apiBaseUrl` 写入扩展的 `chrome.storage.sync`（content script 在 `index.tsx` **模块顶层**监听，Crow 自站点不挂载浮层 App 时也能收到）。
- 划词存笔记时请求带 `Authorization: Bearer <jwt>`，与网站笔记本 API 一致；CORS 预检需允许 `Authorization`（由 Web 端 `cors` 工具配置保证）。

**不做（本阶段仍不考虑）：**
- 插件内独立登录 / 完整账户系统（可列 Phase 6+）
- 离线缓存解释结果
