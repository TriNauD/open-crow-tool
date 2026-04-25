# Phase 4：外部订阅接入 — 开发计划

> 版本：v1.0 | 2026-04-25

## 目标

最小改动让外部用户能订阅周报并收到邮件。付费（Stripe）预留字段但不实现。

## 核心用户流程

用户访问 `/subscribe` → 填邮箱提交 → 写入 subscribers 表 → 每周一 Cron 群发（含退订链接） → 点退订 → status 改为 cancelled

## 新增文件

| 文件 | 说明 |
|------|------|
| `lib/db/subscribers.ts` | CRUD：createSubscriber / getActiveSubscribers / cancelByToken |
| `app/api/subscribe/route.ts` | POST，去重入库 |
| `app/subscribe/page.tsx` | 订阅落地页（client component） |
| `app/api/unsubscribe/route.ts` | GET ?token=xxx → 标记 cancelled → 重定向 |
| `app/unsubscribe/page.tsx` | 退订确认页（server component，读 searchParams） |

## 改造文件

| 文件 | 改动 |
|------|------|
| `lib/email.ts` | `sendWeeklyDigest(repos, to, unsubscribeUrl?)` 新签名，footer 加退订链接 |
| `app/api/cron/weekly-digest/route.ts` | 从单人改为群发所有 active 订阅者，DIGEST_TO_EMAIL 保留作管理员兜底 |

## DB DDL

```sql
create table subscribers (
  id                     uuid primary key default gen_random_uuid(),
  email                  text unique not null,
  status                 text default 'active',
  stripe_customer_id     text,
  stripe_subscription_id text,
  unsubscribe_token      uuid default gen_random_uuid(),
  subscribed_at          timestamptz default now(),
  cancelled_at           timestamptz
);
create index subscribers_status_idx on subscribers(status);
create index subscribers_unsubscribe_token_idx on subscribers(unsubscribe_token);
```

## 无新增环境变量

`DIGEST_TO_EMAIL` 复用作管理员兜底地址。
