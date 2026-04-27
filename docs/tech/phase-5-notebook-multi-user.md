## 八、Phase 5：Notebook 多用户改造（2026-04-26 ✅）

### 目标

将笔记本从单管理员模式（`ADMIN_SECRET` + 固定 `ADMIN_USER_ID`）升级为真实多用户系统，每个注册用户的笔记完全隔离。

### 改动文件清单

```
新增：
  app/login/page.tsx                        — 登录页
  app/register/page.tsx                     — 注册页
  app/api/notes/migrate-guest/route.ts      — 游客笔记迁移 API（幂等 upsert）
  components/AuthNav.tsx                    — 导航栏登录态组件
  components/GuestMigrationModal.tsx        — 登录后游客笔记迁移弹窗
  hooks/useAuthSession.ts                   — Supabase 会话管理 hook
  lib/supabase/browser.ts                   — 浏览器端 Supabase 客户端单例
  lib/api/notes-client.ts                   — 前端笔记 API 调用封装
  lib/guest-notes.ts                        — localStorage 游客笔记读写工具
  lib/config/notebook.ts                    — NOTEBOOK_MULTI_USER_ENABLED 开关
  lib/observability/notebook.ts             — 笔记模块可观测性埋点
  db/migrations/20260426_notebook_multi_user.sql — RLS 策略 + client_note_id 字段

修改：
  lib/db/client.ts    — 新增 createUserDbClient(accessToken)
  lib/db/notes.ts     — 所有操作改为接受 NoteDbContext { db, userId } 参数
  lib/utils/auth.ts   — 废弃 isAuthorized，新增 getRequestUser / unauthorizedResponse
  app/api/notes/route.ts         — 改为 Bearer token 鉴权 + 用户态 DB 客户端
  app/api/notes/[id]/route.ts    — 同上
  app/notebook/page.tsx          — 接入会话 hook，支持游客/登录双模式
  app/page.tsx                   — 接入会话 hook，加 GuestMigrationModal
  components/ExplanationCard.tsx — 游客保存走 localStorage，登录态走 API
  .env.local.example             — 新增前端 NEXT_PUBLIC_* 变量，移除 ADMIN_USER_ID

删除：
  app/actions.ts                 — 原 Server Actions 模式废弃
```

### 数据库 Migration

```sql
-- 见 db/migrations/20260426_notebook_multi_user.sql
-- 1. notes 表新增 client_note_id 字段（游客迁移幂等用）
-- 2. 启用 RLS，配置四条策略（select/insert/update/delete 各一条）
-- 3. 创建 (user_id, client_note_id) 唯一索引（幂等插入防重）
```

### 鉴权架构

```
浏览器（已登录）
  → Supabase Auth Session（JWT）
  → fetch /api/notes  { Authorization: Bearer <jwt> }

API Route
  → getAccessTokenFromRequest(req)  → Bearer token
  → getRequestUser(req)             → db.auth.getUser(token) → User
  → createUserDbClient(token)       → anon key + Bearer → 用户态 Supabase client
  → getNotes({ db, userId }) / saveNote / deleteNote / ...

Supabase Postgres
  → RLS: auth.uid() = user_id       → 每行只能被归属用户操作
```

### 上线风控

- **熔断**：`NOTEBOOK_MULTI_USER_ENABLED=false` → API 返回 503，快速止损
- **监控**：`logNotebookMetric` 埋点，覆盖 `auth_failed` / `request_failed` / `guest_migration_*`
- **回滚手册**：见 `docs/notebook-multi-user-rollout.md`

