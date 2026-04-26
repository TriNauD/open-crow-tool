# 周报上线就绪 — QA 测试

> 作者：QA | 创建：2026-04-26 | 结论：**PASS**

---

## 影响域标注

**本次改动触及的模块：**
- `lib/email.ts` — 新增 sendWelcomeEmail / sendReactivationEmail / sendUnsubscribeConfirmEmail，重构为共享 sendMail 层
- `lib/db/subscribers.ts` — createSubscriber 新增 reactivation 路径，cancelByToken 返回类型变更
- `app/api/subscribe/route.ts` — 新增 rate limit，接入欢迎邮件 / 欢迎回来邮件
- `app/api/unsubscribe/route.ts` — 接入退订确认邮件
- `app/api/cron/weekly-digest/route.ts` — DIGEST_TEST_EMAILS ∩ active subscribers 交集逻辑 + SUBSCRIBER_SEND_ENABLED 开关
- `app/subscribe/page.tsx` — 新增 reactivated 状态展示

**风险等级：medium**

---

## 功能测试（新功能）

| # | 用例 | 状态 | 备注 |
|---|---|---|---|
| F1 | 新邮箱订阅收到欢迎邮件 | ✅ | |
| F2 | 已退订邮箱重新订阅显示「欢迎回来！」 | ✅ | |
| F3 | 已 active 邮箱再次订阅显示「已订阅过了」 | ✅ | |
| F4 | 退订收到确认邮件 | ✅ | |
| F5 | rate limit 第 4 次返回 429 | ✅ | |
| F6 | DIGEST_TEST_EMAILS 多邮箱均收到 | ✅ | |
| F7 | SUBSCRIBER_SEND_ENABLED 关闭时订阅者不收邮件 | ✅ | log 字段为 subscriberSendEnabled:false + recipientCount（非旧版 subscriberSendSkipped） |

---

## 回归测试（受影响模块）

| # | 用例 | 状态 | 备注 |
|---|---|---|---|
| R1 | sendMail 重构后周报邮件正常发出 | ✅ | |
| R2 | cancelByToken 返回类型变更后退订流程正常 | ✅ | |
| R3 | Vercel 生产群发（待上线时补验） | ⏳ | |

---

## 测试结论

✅ **PASS** — 本地所有用例通过，用户验收通过（2026-04-26）

**遗留说明：**
- 旧邮件退订链接失效属预期行为（reactivation 后生成新 token），无需修复
- R3 Vercel 生产群发待配置 `SUBSCRIBER_SEND_ENABLED=SEND_TO_SUBSCRIBERS` 后补验
