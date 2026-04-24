# 数据库地基 — 上下文记录

## 关键设计决策

### 为什么 Web 前端不走 /api/notes？
Web 前端使用 Server Actions，在服务端直接调用 lib/storage.ts，
ADMIN_SECRET 和 SUPABASE_SERVICE_ROLE_KEY 永远不出服务端边界。
/api/notes REST 接口只暴露给 Chrome 插件（Phase 2），它是外部客户端必须带 secret。

### saveNote 改为 async 的影响
ExplanationCard.tsx 的 handleSave 当前是同步的，用了 `const entry = saveNote(...)` 拿 id。
改造后需要：
- handleSave 改为 async
- `const entry = await saveNoteAction(...)` 
- setSavedId(entry.id)
- 加 try/catch 处理失败

### notebook/page.tsx 保持 'use client'
页面有 useState（搜索词、展开状态），不能变成纯 Server Component。
但数据获取从 useEffect + localStorage 改为 useEffect + server action。

## 依赖的环境变量
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- ADMIN_SECRET
- ADMIN_USER_ID（一个固定 UUID，所有笔记归这个用户）

## Supabase DDL（需手动在 Supabase SQL Editor 执行）
```sql
create table if not exists notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  input_text  text not null,
  explanation text not null,
  parent_id   uuid references notes(id) on delete set null,
  parent_text text,
  source      text default 'web',
  saved_at    timestamptz default now(),
  tags        text[] default '{}'
);
create index if not exists notes_user_id_idx on notes(user_id);
create index if not exists notes_fts_idx
  on notes using gin(to_tsvector('simple', input_text || ' ' || explanation));
```
