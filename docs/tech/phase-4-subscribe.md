## 七、Phase 4：外部订阅接入

### 新增文件

```
新增：
  lib/db/subscribers.ts               — 订阅者 CRUD（createSubscriber / getActiveSubscribers / cancelByToken）
  app/api/subscribe/route.ts          — POST，邮箱去重入库，status 直接 active
  app/subscribe/page.tsx              — 订阅落地页（client component，表单提交）
  app/api/unsubscribe/route.ts        — GET ?token=xxx → 标记 cancelled → redirect
  app/unsubscribe/page.tsx            — 退订确认页（server component，await searchParams）

改造：
  lib/email.ts                        — sendWeeklyDigest(repos, to, unsubscribeUrl?) 新签名
  app/api/cron/weekly-digest/route.ts — 群发所有 active 订阅者，DIGEST_TO_EMAIL 保留作管理员兜底
  .env.local.example                  — 加入 DDL 注释（无新环境变量）
```

### DB DDL（在 Supabase SQL Editor 执行）

```sql
create table subscribers (
  id                     uuid primary key default gen_random_uuid(),
  email                  text unique not null,
  status                 text default 'active',   -- active/cancelled
  stripe_customer_id     text,                    -- Phase 5 预留
  stripe_subscription_id text,                    -- Phase 5 预留
  unsubscribe_token      uuid default gen_random_uuid(),
  subscribed_at          timestamptz default now(),
  cancelled_at           timestamptz
);
create index subscribers_status_idx on subscribers(status);
create index subscribers_unsubscribe_token_idx on subscribers(unsubscribe_token);
```

### 关键架构设计

```
用户 → POST /api/subscribe → lib/db/subscribers.ts → Supabase subscribers 表
                                                              ↑
Vercel Cron → GET /api/cron/weekly-digest
  → getActiveSubscribers() 查询所有 active 订阅者
  → 逐一调用 sendWeeklyDigest(reviewed, sub.email, unsubscribeUrl)
  → 同时发给 DIGEST_TO_EMAIL（管理员兜底，无退订链接）

用户点退订链接 → GET /api/unsubscribe?token=xxx
  → cancelByToken(token) 标记 cancelled
  → 重定向到 /unsubscribe?status=success
```

### 无新增环境变量

退订链接的 baseUrl 从 `new URL(req.url).origin` 动态获取，无需硬编码。

