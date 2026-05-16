# 周报 Cron 运维通知邮件 — 技术方案

## 目标

在 `GET /api/cron/weekly-digest` 生命周期末尾（及抓取阶段的致命失败点）向运维邮箱发送 **HTML 汇总**，内容包含：

- 本轮 UTC 时间戳
- `SUBSCRIBER_SEND_ENABLED` 是否全量、库内 active 数、本轮实际收件人数
- 发送成功数 / 失败数、失败收件人邮箱列表
- `aiUsed`、`fallback`、可选 `tierDistribution`、可选 `aiError`（抓取成功后 AI 路径若抛错会降级，错误文案进运维邮件）
- 抓取失败或 Trending 为空：**不进入发信循环**，单独发 **中止** 邮件（subject 含 stage）

## 实现要点（与代码对齐）

| 项 | 说明 |
|----|------|
| 模块 | `lib/email.ts`：`sendDigestOpsReportComplete`、`sendDigestOpsReportAborted` 及 payload 类型 |
| 调用点 | `app/api/cron/weekly-digest/route.ts`：抓取 `catch`、trending 为空、发信循环结束后的 `try/catch` 包裹 |
| 环境变量 | `DIGEST_OPS_NOTIFY_EMAILS`（逗号分隔，空则整条能力关闭） |
| 可选 | `DIGEST_OPS_NOTIFY_ONLY_ON_FAILURE=true` 时：**仅当**存在发信失败才发「完成」汇总；全成功则不发（中止类邮件不受影响） |

## 非目标（本期不做）

- Resend Webhooks 对「投递/退信」的二次对账（可另立项）。
- 将运维汇总写入数据库表。

## 回滚

清空或删除环境中的 `DIGEST_OPS_NOTIFY_EMAILS` 即可关闭运维邮件；业务发信逻辑不变。
