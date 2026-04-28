# 这是啥？— 技术架构与执行计划 (PLAN)

> 版本：v1.5 | 作者：TL | 最后更新：2026-04-28  
> **v1.5**：技术长文**按章拆卷**到 [`docs/tech/`](./tech/README.md)，本文件为**总览与导航**。  
> **2026-04-28**：BRAINSTORM **阶段 A** 已结项（Vitest、Playwright E2E、扩展 build 见 CI）；归档 `dev/done/BRAINSTORM阶段A/`。需求池与未启动条目见 [`dev/active/BRAINSTORM需求池/README.md`](../dev/active/BRAINSTORM需求池/README.md)。

---

## 一、分卷阅读（主入口）

| 章节 | 路径 |
|------|------|
| **技术分卷目录与说明** | [`docs/tech/README.md`](./tech/README.md) |
| 整体架构 + 技术选型 | [`docs/tech/overview.md`](./tech/overview.md) |
| 数据库与 DDL 草案、环境变量片段 | [`docs/tech/database.md`](./tech/database.md) |
| Phase 1～2（地基与 Chrome） | [`./tech/phase-1-database-baseline.md`](./tech/phase-1-database-baseline.md)、[`./tech/phase-2-chrome-extension.md`](./tech/phase-2-chrome-extension.md) |
| Phase 3～4（周报与订阅） | [`./tech/phase-3-weekly-digest.md`](./tech/phase-3-weekly-digest.md)、[`./tech/phase-4-subscribe.md`](./tech/phase-4-subscribe.md) |
| Phase 5（多用户笔记本） | [`docs/tech/phase-5-notebook-multi-user.md`](./tech/phase-5-notebook-multi-user.md) |
| 代码规范与里程碑表 | [`docs/tech/constraints-and-milestones.md`](./tech/constraints-and-milestones.md) |

**新需求/结项**时：在涉及的分卷中更新实现细节与文件清单；与产品不一致处先对 `docs/product/` 或 PM 确认。回滚、风控以 `dev/logs/…`、`docs/notebook-multi-user-rollout.md` 等专文为准时，从对应分卷链出即可。

---

## 二、与团队流程的关系

用户批准方案后，对 **PLAN 的 commit** 体现为对 **本总览** 和/或 **`docs/tech/*` 分卷** 的更新。交付管道见 `.cursor/rules/product-delivery-pipeline.mdc` 与 `dev-workflow.mdc`。

---

## 三、架构一瞥（与 `docs/tech/overview` 一致）

更完整的 ASCII 图与选型表见 [`docs/tech/overview.md`](./tech/overview.md)。

```
┌──────────────────────────────────────────────────────────────┐
│                          用户入口                              │
│   Web (Next.js)                 Chrome Extension (Vite)       │
│   登录态 Bearer JWT；「连接插件」   存笔记：Bearer（与 Web 一致）   │
│   postMessage → storage.sync      （`accessToken` + `apiBaseUrl`）│
└──────────┬─────────────────────────────┬──────────────────────┘
           │                             │
           ▼                             ▼
┌──────────────────────────────────────────────────────────────┐
│                Next.js API Routes (Vercel)                    │
│  /api/explain   /api/notes   /api/notes/[id]                 │
│  /api/notes/migrate-guest    /api/cron/weekly-digest          │
│  ↑ Web 笔记 API：Bearer JWT → getRequestUser() 校验           │
└──────────┬─────────────────────────────┬──────────────────────┘
           │                             │
           ▼                             ▼
    ┌─────────────┐      ┌──────────────────────────────┐
    │  AI Provider │      │       Supabase Postgres       │
    │  (OpenAI /   │      │  notes 表（RLS 行级隔离 ✅）   │
    │  SiliconFlow)│      │  subscribers 表               │
    └─────────────┘      └──────────────────────────────┘
```
