# Chrome 划词插件（模块 B，Phase 2 核心）

> **给最终用户（非开发）**：安装、连接插件与常见问题见 **[简明使用手册](../notes/chrome-extension-使用手册.md)**。

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

**鉴权（与多用户笔记本对齐，2026-04-27 ✅；C-3 扩展内登录 MVP）：**
- **主路径**：扩展 **Options** 内用与网站相同的邮箱/密码登录；成功后写入与网站桥接一致的 `CrowAuth`（含 refresh）。构建时需配置 `VITE_PUBLIC_SUPABASE_*` 与 `VITE_PUBLIC_SITE_ORIGIN`（见 `chrome-extension/.env.example`）。
- **快捷同步**：用户在 **Web 端登录** 后，导航栏点 **「连接插件」**；网站通过 `postMessage` 将会话字段写入扩展的 **`chrome.storage.local`**（content script 在 `index.tsx` **模块顶层**监听）。与扩展内登录 **后写覆盖**。
- **高级**：Options 折叠区可手动填 API 地址与令牌（自托管/排障）。
- 划词存笔记时请求带 `Authorization: Bearer <jwt>`，与网站笔记本 API 一致；CORS 预检需允许 `Authorization`（由 Web 端 `cors` 工具配置保证）。

**进行中 / Future Features（与文档同步）：**
- **追问树形索引（文档先行，编码下轮）**：追问嵌套多轮后，主卡左侧显示可收起的树形大纲（节点 = 各卡问题，缩进 = 层级）；阈值（嵌套 ≥2 层或追问 ≥3 条）出现，点击定位+橙色高亮，目标被折叠自动展开 — [`dev/active/追问树形索引/`](../../dev/active/追问树形索引/)。
- **本批接手手册**：[FUTURE-FEATURES-HANDOFF](../../dev/active/BRAINSTORM需求池/FUTURE-FEATURES-HANDOFF.md)（分支 `fea/future-features`，**暂不合 `dev`**）。
- **C-3 扩展内独立登录（已合 future）**：方案 A — Options + GoTrue password grant；目录 [`dev/active/Chrome扩展内登录/`](../../dev/active/Chrome扩展内登录/)，手测 [`Chrome扩展内登录-manual-test.md`](../../dev/active/Chrome扩展内登录/Chrome扩展内登录-manual-test.md)。
- **插件内 session refresh**：网站「连接插件」下发 `refresh_token` 与公开 Supabase URL/anon key；扩展写入 `chrome.storage.local`，在请求前与 401 时用 Supabase 刷新 access token，减少散发使用下的过期重连。需求目录：`dev/active/Chrome扩展插件内refresh/`（结项后可迁 `dev/done`）。
- **B-2 划词上下文（已合 future）**：划词解释自动附带前后纯文本 `surroundingText`（前后各约 120 字；失败静默降级）— [`dev/active/划词上下文/`](../../dev/active/划词上下文/)。
- **划词保存重复笔记校验（已合 future）**：扩展保存前对齐 Web normalize 查重（都保留/覆盖）— [`dev/active/划词保存重复笔记校验/`](../../dev/active/划词保存重复笔记校验/)。
- **D-2 飞书等平台（已合 future：stub / No-Go）**：`POST /api/feishu/events` → 501；评估见 [`飞书等平台-evaluation.md`](../../dev/active/飞书等平台/飞书等平台-evaluation.md)。
- **暂停划词开关（✅ 2026-05-16 结项）**：Popup/Options 共用 `crow_extension_enabled`（缺省开启）；关时卸载划词 UI、快捷键不进入解释；**保留**网站「连接插件」桥接。未连接账号时仍可调用公开 `/api/explain` 查看解释，**存入笔记本**前引导连接。详情与验收：`dev/done/Chrome扩展暂停划词开关/`、`dev/logs/Chrome扩展暂停划词开关-log.md`。
- **站点兜底域统一（✅ 2026-08-31）**：`VITE_PUBLIC_SITE_ORIGIN` 不设置时构建产物默认生产域 **`https://www.crowknows.tech`**——覆盖未登录划词解释、扩展内登录默认 apiBaseUrl 与 Options 占位符（此前硬编码 dev 站，生产用户未登录时请求会打到团队 Preview 且被部署保护拦成 401）；联调构建显式设 `VITE_PUBLIC_SITE_ORIGIN=https://dev.crowknows.tech`。

**不做（本阶段仍不考虑）：**
- 离线缓存解释结果
