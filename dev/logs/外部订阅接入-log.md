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

---

## Bug 记录

### BF-1：GET 退订即改库，邮件客户端预取导致「没点就被退订」（2026-08-31，ROADMAP R3）

- **现象**：`GET /api/unsubscribe?token=...` 收到请求即把订阅改为 cancelled。Apple Mail 隐私代理、Outlook SafeLinks 等会自动预取邮件内链接 → 用户没点就被退订，周报直接流失。复现：`curl <退订链接>` 后查库即见 cancelled。
- **根因**：退订动作挂在 GET 上，没有「用户意图」确认步骤；预取类爬虫与真实点击无法区分。
- **涉及文件**：`lib/db/subscribers.ts`（新增只读 `getSubscriberByToken`）、`app/api/unsubscribe/route.ts`（GET 只读查询跳确认页；POST 接收确认表单才调 `cancelByToken`，Origin 校验纵深防御，303 回状态页）、`app/unsubscribe/page.tsx`（确认模式：脱敏邮箱 + 「确认退订」表单 + 「我再想想」；状态模式保留 success/notfound/invalid）。
- **验证**：`__tests__/unsubscribe-two-step.test.ts` 8 用例（GET 不改库/POST 才取消并确认邮件/第三方 Origin 403/缺 token/无效 token）；验收口径「curl 直接 GET 后订阅状态不变」满足。手测路径：点邮件退订链接 → 确认页 → 点确认 → success 页 + 确认邮件。
- **分支 / PR**：`bugfix/unsubscribe-two-step` → [#36](https://github.com/TriNauD/open-crow-tool/pull/36)（待合并）
- **备注**：邮件内的退订 URL 形态不变（仍是 `/api/unsubscribe?token=`），老邮件里的链接同样生效；同邮箱重新订阅即复活（新 token）。
