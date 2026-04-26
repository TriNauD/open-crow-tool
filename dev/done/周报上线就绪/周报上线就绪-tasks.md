# 周报上线就绪 — 任务清单

> 作者：TL | 创建：2026-04-26 | 用户验收通过：2026-04-26

---

## Feature 1：发送开关 + 内测邮件列表

- [x] 改造 `app/api/cron/weekly-digest/route.ts`：
  - [x] 读取 `DIGEST_TEST_EMAILS`（逗号分隔）∩ active subscribers，fallback 到 `DIGEST_TO_EMAIL`
  - [x] `SUBSCRIBER_SEND_ENABLED=SEND_TO_SUBSCRIBERS` 才群发所有 active 订阅者
  - [x] log 记录 `subscriberSendEnabled`、`activeSubscribers`、`recipientCount`
- [x] 更新 `.env.local.example`：新增 `DIGEST_TEST_EMAILS`、`SUBSCRIBER_SEND_ENABLED` 说明

## Feature 2：订阅成功欢迎邮件

- [x] `lib/email.ts` 新增 `sendWelcomeEmail(to, unsubscribeUrl)`
- [x] `app/api/subscribe/route.ts`：新订阅成功后 fire-and-forget 发欢迎邮件

## Feature 3：订阅接口基础防滥

- [x] `app/api/subscribe/route.ts` 加 in-memory rate limit（同 IP 60s 内最多 3 次）
- [x] 超限返回 429

## Feature 4：退订确认邮件

- [x] `lib/email.ts` 新增 `sendUnsubscribeConfirmEmail(to, resubscribeUrl)`
- [x] `app/api/unsubscribe/route.ts`：退订成功后 fire-and-forget 发确认邮件

## Bugfix：退订用户重新订阅

- [x] `lib/db/subscribers.ts`：`createSubscriber` 新增 reactivation 路径（cancelled → active + 新 token）
- [x] `lib/email.ts`：新增 `sendReactivationEmail`（"欢迎回来"版本）
- [x] `app/api/subscribe/route.ts`：根据 `reactivated` 字段选择邮件类型
- [x] `app/subscribe/page.tsx`：新增 `reactivated` 状态展示「欢迎回来！」

## 验收标准

- [x] 开关关闭时，luna 不收邮件，log 有 `subscriberSendEnabled: false`，`recipientCount` 只含内测邮箱数
- [x] DIGEST_TEST_EMAILS 多邮箱，两个都能收到
- [x] 新订阅成功后，收到欢迎邮件，含退订链接
- [x] 点退订链接，DB status 变 cancelled，收到退订确认邮件
- [x] 退订确认邮件极简，有重新订阅链接
- [x] 同一 IP 60s 内第 4 次 POST /subscribe 返回 429
- [x] 已退订邮箱重新订阅，显示「欢迎回来！」，收到欢迎回来邮件
- [ ] Vercel：设置 `SUBSCRIBER_SEND_ENABLED=SEND_TO_SUBSCRIBERS`，触发 cron，真实订阅者收到邮件（待生产上线时验证）

## 上线操作清单

- [x] 本地全部验收通过
- [ ] Vercel Settings > Environment Variables 添加 `DIGEST_TEST_EMAILS` + `SUBSCRIBER_SEND_ENABLED=SEND_TO_SUBSCRIBERS`
- [x] 真实用户邮箱（luna）已加入 subscribers 表
- [ ] 下次周一 17:00 北京时间自动触发，或手动触发一次生产确认
