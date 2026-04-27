## 三、数据库设计

### Supabase 初始化

1. 创建 Supabase 项目
2. 在 SQL Editor 执行建表语句
3. 将连接串写入 `.env.local`

### DDL（在 Supabase SQL Editor 执行）

```sql
-- notes 表
create table if not exists notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,           -- 当前阶段固定常量，预留多用户
  input_text  text not null,
  explanation text not null,
  parent_id   uuid references notes(id) on delete set null,
  parent_text text,
  source      text default 'web',      -- 'web' | 'chrome_extension'
  saved_at    timestamptz default now(),
  tags        text[] default '{}'
);

-- 按 user_id 查询的索引
create index if not exists notes_user_id_idx on notes(user_id);
-- 全文搜索索引（中英文都支持）
create index if not exists notes_fts_idx
  on notes using gin(to_tsvector('simple', input_text || ' ' || explanation));
```

### 环境变量新增

```bash
# Supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxxx           # 后端专用，绝对不暴露给前端
SUPABASE_ANON_KEY=xxxx                   # Phase 5 新增：用于用户态 DB 客户端
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co   # Phase 5 新增：浏览器端登录用
NEXT_PUBLIC_SUPABASE_ANON_KEY=xxxx       # Phase 5 新增：浏览器端登录用

# 鉴权：历史 Phase 1-2 的 ADMIN_SECRET；扩展多用户改造后主要走网站登录 + Bearer。
# 部分运维/回滚脚本仍可能引用；扩展成功连接后会清理本地旧 adminSecret。
ADMIN_SECRET=你自己设置的随机字符串（建议 32 位）
# ADMIN_USER_ID 已废弃，Phase 5 后不再使用
```
