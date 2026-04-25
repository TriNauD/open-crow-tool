# 外部订阅接入 — 开发日志

> 日期：2026-04-25

## 关键决策

1. **精简计划**：原方案包含 Stripe 全套（8 个新文件），用户反馈"太重了"，精简为 5 个新文件 + 2 个改造，Stripe 字段预留但代码不实现。

2. **sendWeeklyDigest 签名变更**：
   - 旧：`sendWeeklyDigest(repos: ReviewedRepo[])`（from env）
   - 新：`sendWeeklyDigest(repos, to, unsubscribeUrl?)`
   - 调用方（cron route）负责传入 `to` 和 `unsubscribeUrl`，email.ts 不再读 env 中的收件人

3. **退订 URL 不需要新环境变量**：cron route 中通过 `new URL(req.url).origin` 动态获取 baseUrl，不依赖硬编码域名。

4. **Next.js 16 searchParams**：unsubscribe 确认页是 server component，`searchParams` 是 Promise，已按文档用 `await searchParams` 处理。

5. **cancelByToken 用 `.maybeSingle()`**：token 不存在时不报错，直接返回 `false`，cron/退订链接点击无副作用。

## 文件变动

| 文件 | 操作 |
|------|------|
| `lib/db/subscribers.ts` | 新增 |
| `app/api/subscribe/route.ts` | 新增 |
| `app/subscribe/page.tsx` | 新增 |
| `app/api/unsubscribe/route.ts` | 新增 |
| `app/unsubscribe/page.tsx` | 新增 |
| `lib/email.ts` | 改造（签名 + footer） |
| `app/api/cron/weekly-digest/route.ts` | 改造（群发 + 引入 getActiveSubscribers） |
| `.env.local.example` | 更新（加 DDL 注释） |
