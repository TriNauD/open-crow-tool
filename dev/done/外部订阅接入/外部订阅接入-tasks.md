# Phase 4：外部订阅接入 — 任务清单

## 开发任务

- [x] 新增 `lib/db/subscribers.ts`（createSubscriber / getActiveSubscribers / cancelByToken）
- [x] 新增 `app/api/subscribe/route.ts`（POST，去重入库）
- [x] 新增 `app/subscribe/page.tsx`（订阅落地页）
- [x] 新增 `app/api/unsubscribe/route.ts`（GET ?token=xxx → redirect）
- [x] 新增 `app/unsubscribe/page.tsx`（退订确认页）
- [x] 改造 `lib/email.ts`（sendWeeklyDigest 新签名，footer 加退订链接）
- [x] 改造 `app/api/cron/weekly-digest/route.ts`（群发所有 active 订阅者）
- [x] 更新 `.env.local.example`（加入 DDL 注释）

## 待用户操作

- [x] 在 Supabase SQL Editor 执行 DDL（建 subscribers 表）

## 验收标准

- [x] 访问 `/subscribe`，填邮箱提交，Supabase Table Editor 里能看到新记录
- [x] 手动触发 cron，该邮箱收到邮件，邮件底部有退订链接
- [x] 点退订链接，DB 里 status 变 cancelled，下次 cron 不再发送
- [x] 重复提交同一邮箱，返回"已订阅"而不报错

## 用户验收结论

✅ 用户验收通过（2026-04-26）
