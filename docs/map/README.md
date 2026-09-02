# 代码地图（AI 代理 / 新成员定位用）

> 目标：改任何一块代码前，读本文件 + 对应分卷即可定位到**文件级**（含坑），不再派子代理全库探查。
> 本目录只管「哪里有什么、接缝在哪、坑在哪」；设计与实现叙事看 [docs/tech/](../tech/)，需求流程与立项看 [dev/](../../dev/)。

## 用法（AI 代理约定，正文见根目录 AGENTS.md）

- **开工**：先读本文件 → 按改动点读对应分卷（下表）→ 仅当地图未覆盖目标代码时才允许探查，且探查结论必须回写地图。
- **收工**：改动涉及的分卷必须同步更新（文件增删、职责变化、新发现的坑）。
- **防漂移**：`scripts/check-map.mjs` 挂在 `npm run verify` 与 CI——分卷里列出的文件不存在、或源码目录出现未收录的 `.ts/.tsx/.sql` 文件时，构建直接红。

## 分卷索引

| 分卷 | 覆盖目录 | 一句话 |
|---|---|---|
| [web-api.md](./web-api.md) | `app/api/` | 全部后端路由：流式解释 / 笔记 CRUD / 游客迁移 / URL 抓取 / 订阅退订 / 周报 cron / 飞书 stub |
| [web-ui.md](./web-ui.md) | `app/` 页面 + `components/` + `hooks/` | Next.js 页面与 Web 端共享 UI、流式 explain hook |
| [lib-core.md](./lib-core.md) | `lib/` + `db/migrations/` | 后端/共享业务逻辑：AI provider 链、数据访问、CORS、鉴权、SSRF 防护、邮件、游客笔记 |
| [ext-content.md](./ext-content.md) | `chrome-extension/src/content/` | 划词浮标 + 解释卡（content script，扩展最大单体） |
| [ext-platform.md](./ext-platform.md) | `chrome-extension/src/` 其余部分 | MV3 service worker、会话桥与扩展内登录、Options/Popup、打包配置 |

## 全局接缝（跨模块改动先看这里）

1. **Web ↔ 扩展通信**：扩展直连 Web 的 REST API；CORS 由 `lib/utils/cors.ts` 统一给出（新增请求头必须同步 `Access-Control-Allow-Headers`，否则扩展预检失败）；鉴权用 Bearer JWT（`lib/utils/auth.ts` 的 `getRequestUser`）。
2. **登录态桥（网页 → 扩展）**：已登录网页在导航栏「连接扩展」时 postMessage 广播会话（`components/AuthNav.tsx`，网页侧唯一直发点）→ `chrome-extension/src/content/crow-auth-broadcast.ts` 接收 → `chrome-extension/src/lib/crow-session.ts` 写 `chrome.storage.local`；同源校验用 `lib/utils/same-page-origin.ts`。
3. **扩展内登录（旁路）**：GoTrue password grant 直连（`chrome-extension/src/lib/supabase-password-login.ts`），与网页登录态互相独立；refresh 走「SW 优先、直连兜底」双通道（`chrome-extension/src/lib/crow-session.ts` 的 `ensureFreshAuth`）。
4. **流式解释链**：`hooks/useStreamExplain.ts`（Web）/ `chrome-extension/src/content/useStreamExplain.ts`（扩展）→ `POST /api/explain`（`text/plain` ReadableStream 分块）→ `lib/ai/providers.ts` provider 链。
5. **周报链**：`app/api/cron/weekly-digest/route.ts`（Vercel cron，配置在 `vercel.json`）→ `lib/github-trending.ts` 抓 Trending + `lib/email.ts` 分级发信 + 运维通知。

## 平行实现警示（刻意复制，改动必须双侧同步）

| Web 版 | 扩展版 | 说明 |
|---|---|---|
| `hooks/useStreamExplain.ts` | `chrome-extension/src/content/useStreamExplain.ts` | 流式 explain 客户端 |
| `lib/user-llm-config.ts`（localStorage） | `chrome-extension/src/lib/user-llm-config.ts`（chrome.storage） | 头常量 `x-crow-llm-config` 两边必须一致 |
| `lib/notes/normalize-input.ts` | `chrome-extension/src/content/normalize-note-input.ts` | 重复笔记查重的规范化 |
| `components/ExplanationCard.tsx` | `chrome-extension/src/content/ExplainCard.tsx` | 解释卡 UI，同源不同实现 |

## 文档导航（本目录不重复其内容）

- 整体架构与技术选型叙事：[docs/tech/overview.md](../tech/overview.md)；「进行中需求 ↔ 代码路径」对照表：[docs/tech/README.md](../tech/README.md)
- 产品功能分卷：[docs/product/](../product/)；需求立项与任务流：[dev/active/](../../dev/active/)；BF / 结项日志：[dev/logs/](../../dev/logs/)
- 需求池接手清单：[FUTURE-FEATURES-HANDOFF](../../dev/active/BRAINSTORM需求池/FUTURE-FEATURES-HANDOFF.md)
- CI 等价本地校验：`npm run verify`（地图校验 → lint → test → build → 扩展 build，详见 `scripts/verify.mjs`）
