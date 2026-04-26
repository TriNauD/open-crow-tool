# 周报上线就绪 — 任务清单

> 作者：TL | 创建：2026-04-26

---

## Feature 1：发送开关 + 内测邮件列表

- [ ] 改造 `app/api/cron/weekly-digest/route.ts`：
  - [ ] 读取 `DIGEST_TEST_EMAILS`（逗号分隔），fallback 到 `DIGEST_TO_EMAIL`，始终发送
  - [ ] Step 3 群发段包 `if (process.env.SUBSCRIBER_SEND_ENABLED === 'true')` 开关
  - [ ] 开关关闭时，log 记录 `subscriberSendEnabled: false` 和 `subscriberSendSkipped: true`
  - [ ] log 新增 `testEmailsSent` 计数
- [ ] 更新 `.env.local.example`：新增 `DIGEST_TEST_EMAILS` 注释，废弃说明 `DIGEST_TO_EMAIL`，新增 `SUBSCRIBER_SEND_ENABLED` 说明

## Feature 2：订阅成功欢迎邮件

- [ ] `lib/email.ts` 新增 `sendWelcomeEmail(to, unsubscribeUrl)` 函数
  - 主题：`已订阅 | GitHub 周报「速通热榜」确认`
  - 内容：订阅成功确认 + 发送频率（每周一 17:00 北京时间）+ 内容简介 + 退订链接
  - 复用现有 SMTP 发送逻辑
- [ ] 改造 `app/api/subscribe/route.ts`：新订阅成功后 fire-and-forget 调用 `sendWelcomeEmail`
  - 从 `req.url` 构建 `baseUrl` 和 `unsubscribeUrl`
  - 发送失败只 `console.error`，不影响 201 响应

## Feature 3：订阅接口基础防滥

- [ ] `app/api/subscribe/route.ts` 顶部加 in-memory rate limit（同 IP 60s 内最多 3 次）
- [ ] 超限返回 `{ error: '请求过于频繁，请稍后再试' }` + `429` 状态码

## Feature 4：退订确认邮件

- [ ] `lib/email.ts` 新增 `sendUnsubscribeConfirmEmail(to, resubscribeUrl)` 函数
  - 主题：`已退订 | 你不会再收到 GitHub 周报`
  - 内容极简：确认退订 + 一个重新订阅链接，无任何产品推广
- [ ] 改造 `app/api/unsubscribe/route.ts`：`cancelByToken` 成功后 fire-and-forget 发退订确认邮件
  - 从 `req.url` 构建 `resubscribeUrl`（指向 `/subscribe`）
  - 发送失败只 `console.error`，不影响 redirect 响应

## 验收标准

- [ ] 本地：`SUBSCRIBER_SEND_ENABLED` 未设置时，手动触发 cron，订阅者不收到邮件，log 里有 `subscriberSendSkipped: true`；`DIGEST_TEST_EMAILS` 里的邮箱正常收到
- [ ] 本地：`DIGEST_TEST_EMAILS` 配置多个邮箱，两个都能收到
- [ ] 本地：新订阅成功后，该邮箱收到欢迎邮件，内含退订链接
- [ ] 本地：点击欢迎邮件中的退订链接，DB 里 status 变 cancelled，且收到退订确认邮件
- [ ] 本地：退订确认邮件内容极简，无多余推广，有重新订阅链接
- [ ] 本地：同一 IP 60s 内第 4 次 POST /api/subscribe 返回 429
- [ ] Vercel：设置 `SUBSCRIBER_SEND_ENABLED=true`，触发 cron，真实订阅者收到邮件

## 上线操作清单（真实用户收到邮件前必做）

- [ ] 完成上述全部验收
- [ ] 在 Vercel Settings > Environment Variables 添加 `SUBSCRIBER_SEND_ENABLED=true`
- [ ] 把真实用户邮箱通过 `/subscribe` 页面加入订阅列表（或直接 Supabase 插入）
- [ ] 下次周一 17:00 北京时间自动触发，或手动触发一次确认
