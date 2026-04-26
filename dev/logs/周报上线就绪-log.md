# 周报上线就绪 — 开发日志

> 作者：TL | 日期：2026-04-26

---

## 关键决策记录

**1. SUBSCRIBER_SEND_ENABLED 防误触设计**
- 初版用 `=true`，用户指出注释一行就能误触
- 改为 `=SEND_TO_SUBSCRIBERS`，必须手动打出完整字符串才能激活

**2. DIGEST_TEST_EMAILS 由 bypass 改为交集**
- 初版：测试邮箱完全绕过 DB，直接发送
- 用户指出逻辑不对，应与 active subscribers 取交集
- 改后：测试邮箱必须在 DB 里才能收到邮件，代码路径与真实用户完全一致

**3. cancelByToken 返回类型变更**
- 原返回 `boolean`，退订确认邮件需要邮箱地址
- 改为返回 `{ email: string } | null`，unsubscribe route 直接拿到邮箱发确认邮件

**4. sendMail 共享层提取**
- 原来 sendWeeklyDigest 内联了 SMTP/Resend 发送逻辑
- 新增 sendWelcomeEmail / sendReactivationEmail / sendUnsubscribeConfirmEmail 时提取为 sendMail() 共享函数，消除重复

**5. reactivation bug（验收期间发现）**
- createSubscriber 原来对所有 existing 记录（含 cancelled）返回 alreadyExists:true
- Debug mode 埋点确认后修复：新增第三条路径，cancelled → UPDATE active + 新 token
- 同时新增 sendReactivationEmail 和前端 reactivated 状态展示

---

## 文件改动清单

| 文件 | 类型 | 说明 |
|---|---|---|
| `lib/email.ts` | 改造 | 提取 sendMail()，新增 3 个邮件函数 |
| `lib/db/subscribers.ts` | 改造 | createSubscriber reactivation 路径，cancelByToken 返回类型 |
| `app/api/subscribe/route.ts` | 改造 | rate limit + 欢迎/重新激活邮件 |
| `app/api/unsubscribe/route.ts` | 改造 | 退订确认邮件 |
| `app/api/cron/weekly-digest/route.ts` | 改造 | 交集逻辑 + SEND_TO_SUBSCRIBERS 开关 |
| `app/subscribe/page.tsx` | 改造 | reactivated 状态展示 |
| `.env.local.example` | 改造 | 新增变量说明，废弃 DIGEST_TO_EMAIL |

---

## 遗留 / 后续

- Vercel 生产环境需手动配置 `DIGEST_TEST_EMAILS` 和 `SUBSCRIBER_SEND_ENABLED=SEND_TO_SUBSCRIBERS`
- Rate limit 当前为 in-memory，多 worker 场景不精确，用户量上来后考虑 Upstash Redis
