# 数据库地基 — 开发日志

> Phase 1 | 开始：2026-04-24 | 完成：2026-04-24

## 变更记录

### 2026-04-24
- 初始化需求文档（plan / context / tasks）
- 确定架构：Server Actions 供 Web 用，/api/notes 供 Chrome 插件用
- 安装 @supabase/supabase-js
- 新增 lib/db.ts（Supabase 客户端单例）
- 新增 lib/auth.ts（isAuthorized，校验 x-admin-secret header）
- 改造 lib/storage.ts：从 localStorage 改为 Supabase SDK，全部 async，仅服务端
- 新增 app/actions.ts：Server Actions 封装（getNotesAction / saveNoteAction / deleteNoteAction / searchNotesAction）
- 新增 app/api/notes/route.ts：GET + POST，供 Chrome 插件使用，需 x-admin-secret
- 新增 app/api/notes/[id]/route.ts：DELETE，供 Chrome 插件使用
- 改造 components/ExplanationCard.tsx：handleSave 改为 async，调用 saveNoteAction
- 改造 app/notebook/page.tsx：从 localStorage 改为 server actions，新增来源标签（插件/Web）、loading 状态、搜索 debounce
- 更新 .env.local.example：新增 Supabase 和鉴权变量说明
- 用户验收全部通过 ✅

## 关键架构决策

**为什么 Web 前端不走 /api/notes？**
使用 Server Actions，前端组件调用 server action，action 在服务端直接操作 DB。
ADMIN_SECRET 和 SUPABASE_SERVICE_ROLE_KEY 永远不出服务端边界。
/api/notes REST 接口只暴露给 Chrome 插件（外部客户端，必须带 secret）。

## 遇到的问题

无重大问题。
