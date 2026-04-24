# Session Handoff — 状态快照

> 写于 2026-04-24，用于下一个 Cursor 窗口无缝接手

---

## 项目简介

**"这他妈是啥"（what-the-f-tool）** — AI 驱动的技术黑话翻译工具。

- **线上地址**：https://what-the-f-tool.vercel.app
- **Git 仓库**：本地 `/Users/wesrindo/Documents/1_Study/10_AI Training/ai projects/what-the-f-tool`
- **部署**：Vercel（main 分支自动部署）

---

## 三大功能进度

| 功能 | 阶段 | 状态 |
|------|------|------|
| Web 端 AI 解释 | Phase 0 (MVP) | ✅ 已完成并部署 |
| 数据库持久化（Supabase） | Phase 1 | ✅ 已完成并合并 |
| Chrome 划词插件 | Phase 2 | ✅ 已完成（本地 build 可用） |
| 每周 GitHub Trending 邮件 | Phase 3 | ⏳ 未开始，下一个目标 |

---

## 技术栈

- **Web App**: Next.js (App Router) + Tailwind CSS v4
- **数据库**: Supabase (Postgres，免费版)
- **部署**: Vercel（含 Vercel Cron，供 Phase 3 用）
- **邮件**: Resend（Phase 3）
- **AI**: OpenAI SDK，支持 OpenAI / SiliconFlow / NVIDIA NIM 多后端
- **Chrome 插件**: Vite 5 + React 18 + @crxjs/vite-plugin 2.0.0 + Manifest V3

---

## 目录结构（整理后）

```
/
├── app/                    Next.js 路由
│   ├── api/explain/        AI 解释 API（支持流式输出，有 CORS）
│   ├── api/notes/          笔记 CRUD API（供插件用，有 CORS）
│   ├── notebook/           笔记本页面
│   ├── actions.ts          Server Actions（供 Web 前端用）
│   └── page.tsx            主解释页面
├── components/
│   └── ExplanationCard.tsx 解释结果卡片（含存笔记功能）
├── hooks/
│   └── useStreamExplain.ts 流式 AI 解释 hook
├── lib/
│   ├── ai/
│   │   ├── providers.ts    AI 多后端抽象（OpenAI/SiliconFlow/NVIDIA）
│   │   └── prompts.ts      AI prompt 模板
│   ├── db/
│   │   ├── client.ts       Supabase 客户端单例
│   │   └── notes.ts        笔记 CRUD（async，server-side）
│   └── utils/
│       ├── auth.ts         x-admin-secret 鉴权
│       ├── cn.ts           classnames 工具
│       └── cors.ts         CORS 头 + OPTIONS 处理
├── chrome-extension/       Chrome 插件（独立 Vite 项目）
│   ├── src/content/        划词浮窗（FloatingButton + ExplainCard）
│   ├── src/background/     Service Worker（键盘快捷键）
│   ├── src/options/        插件配置页（API URL + Admin Secret）
│   └── src/popup/          插件 Popup
├── scripts/                Phase 3 cron 等脚本（待填充）
├── docs/                   产品文档
│   ├── PRD.md              需求文档
│   ├── PLAN.md             技术架构方案
│   └── CHECKLIST.md        任务清单
└── dev/                    开发过程文档
    ├── active/             当前需求（空 = 当前无进行中任务）
    ├── done/               已完成需求归档
    │   ├── 数据库地基/
    │   └── Chrome插件/
    └── logs/               开发日志
```

---

## 关键决策备忘

1. **鉴权**：目前用 `x-admin-secret` 简单 API Key（Scheme B），DB 里已有 `user_id` 字段为将来多用户迁移留路
2. **插件键盘快捷键**：Windows/Linux = `Alt+W`，Mac = `Ctrl+Shift+W`（manifest 里用 `MacCtrl+Shift+W`）
3. **LocalStorage 历史数据**：不迁移，新笔记直接上云
4. **CORS**：API 路由全部已加 CORS headers（`lib/utils/cors.ts`），插件从 Vercel 部署的 URL 调用

---

## 环境变量（参考 .env.local.example）

```
# AI
AI_PROVIDER=siliconflow          # 或 openai / nvidia
OPENAI_API_KEY=...
SILICONFLOW_API_KEY=...
NVIDIA_API_KEY=...               # 可选
NVIDIA_FALLBACK=false

# Supabase
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...

# Auth
ADMIN_SECRET=...                 # Chrome 插件配置页填入
ADMIN_USER_ID=...                # UUID，对应 DB 里的 user_id

# Phase 3（待填）
RESEND_API_KEY=
DIGEST_TO_EMAIL=
```

---

## Phase 3 待办：每周 GitHub Trending 邮件摘要

参考 `docs/PLAN.md` Phase 3 章节，主要工作：

1. `scripts/digest.ts` — 爬取 GitHub Trending（Cheerio 解析），调用 AI 摘要，用 Resend 发送邮件
2. `app/api/cron/digest/route.ts` — Vercel Cron 触发点（`GET`，用 `CRON_SECRET` 保护）
3. `vercel.json` — 配置每周定时任务 cron 规则
4. `app/api/digest/preview/route.ts`（可选）— 手动预览邮件内容
5. 环境变量：`RESEND_API_KEY`、`DIGEST_TO_EMAIL`、`CRON_SECRET`

**dev 工作流**：按 `.cursorrules` 要求，在 `dev/active/周报邮件/` 下建 `*-plan.md`、`*-context.md`、`*-tasks.md`，PM 审核后开发，用户验收后提交。

---

## Chrome 插件本地使用说明

```bash
cd chrome-extension
npm install
npm run build    # 生成 dist/
```

然后在 Chrome → 扩展程序 → 加载已解压的扩展 → 选 `chrome-extension/dist/`

插件 Options 页配置：
- API Base URL = `https://what-the-f-tool.vercel.app`
- Admin Secret = 同 `.env.local` 里的 `ADMIN_SECRET`

---

## 上一个会话 Agent Transcript

`10ad9213-6643-41ba-b69d-05674b34a3bf`
