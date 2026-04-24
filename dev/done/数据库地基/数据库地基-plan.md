# 数据库地基 — 开发计划

> Phase 1 | 开始时间：2026-04-24

## 目标
将笔记本从 localStorage 迁移到 Supabase Postgres，实现跨端云端持久化。

## 架构分层（关键决策）

```
'use client' 组件（ExplanationCard, notebook/page）
    ↓  调用 Server Actions（app/actions.ts）
Server Actions（'use server'，服务端运行）
    ↓  直接调用
lib/storage.ts（Supabase SDK，仅服务端）
    ↓
Supabase Postgres
```

REST API `/api/notes` 仅供 Phase 2 Chrome 插件使用（带 x-admin-secret header）。
Web 前端不走 REST API，不持有 ADMIN_SECRET。

## 文件改动

新增：
- `lib/db.ts` — Supabase 客户端单例
- `lib/auth.ts` — isAuthorized 函数
- `app/actions.ts` — Server Actions（saveNoteAction / getNotesAction / deleteNoteAction / searchNotesAction）
- `app/api/notes/route.ts` — GET + POST（Chrome 插件用）
- `app/api/notes/[id]/route.ts` — DELETE（Chrome 插件用）

修改：
- `lib/storage.ts` — 改为 Supabase 调用，全部 async，仅服务端
- `components/ExplanationCard.tsx` — handleSave 改为调用 saveNoteAction
- `app/notebook/page.tsx` — 调用 getNotesAction / deleteNoteAction / searchNotesAction
- `.env.local.example` — 新增 Supabase + ADMIN_SECRET + ADMIN_USER_ID 变量

不改：
- `hooks/useStreamExplain.ts`
- `app/api/explain/route.ts`（加 auth 为可选，本次不做）
- `lib/ai-providers.ts`
