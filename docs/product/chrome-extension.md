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
- **打开笔记本**（新标签打开站点 `{apiBaseUrl}/notebook`，与「存入」并存；阶段 A，2026-04）
- 支持关闭卡片（点击外部区域 / 按 Esc）

**鉴权（与多用户笔记本对齐，2026-04-27 ✅）：**
- 用户在 **Web 端登录** 后，导航栏点 **「连接插件」**；网站通过 `postMessage` 将会话字段（含 `accessToken`、`apiBaseUrl`、refresh 与 Supabase 公开配置等）写入扩展的 **`chrome.storage.local`**（content script 在 `index.tsx` **模块顶层**监听，Crow 自站点不挂载浮层 App 时也能收到）。
- 划词存笔记时请求带 `Authorization: Bearer <jwt>`，与网站笔记本 API 一致；CORS 预检需允许 `Authorization`（由 Web 端 `cors` 工具配置保证）。

**进行中需求（与文档同步）：**
- **C-3 扩展内独立登录（已立项）**：扩展 **Options 主路径** 提供非技术流登录（与网站同一 Supabase 项目）；**保留** 网站「连接插件」快捷同步；**手动粘贴 Token** 仅保留在折叠「高级/开发者」区。计划与任务：[`dev/active/Chrome扩展内登录/`](../dev/active/Chrome扩展内登录/)。
- **插件内 session refresh（开发中，`fea/chrome-ext-session-refresh-tri`）**：网站「连接插件」下发 `refresh_token` 与公开 Supabase URL/anon key；扩展写入 `chrome.storage.local`，在存笔记前与 401 时用 Supabase 刷新 access token。需求目录：`dev/active/Chrome扩展插件内refresh/`。
- **暂停划词开关（已立项，开发顺延）**：Popup/Options 共用开关，关闭时不挂载划词 UI、不响应解释快捷键，**保留**网站「连接插件」桥接。待 refresh 合并后再开工：`dev/active/Chrome扩展暂停划词开关/`。

**不做（本阶段仍不考虑）：**
- 离线缓存解释结果
