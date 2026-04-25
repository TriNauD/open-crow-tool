# Phase 3 周报邮件 — 开发日志

> 日期：2026-04-25 | 状态：✅ 验收通过

---

## 关键决策

| 决策 | 选择 | 理由 |
|---|---|---|
| AI 调用方式 | 单次 batch，返回 JSON 数组 | 比 20 次独立调用省 ~90% token |
| 评审维度 | 技术创新性 + 场景创新性各 1-5 分 | 双维度比单一 star 数更有判断价值 |
| 档位分配 | 由 AI 自由判断，不硬编码分数映射 | 灵活，避免机械规则导致档位失真 |
| 邮件样式 | 内联 CSS | 邮件客户端不支持外部 CSS |
| Cron 鉴权 | Bearer CRON_SECRET | Vercel Cron 自动注入，本地手动测试时手动传 |

## 需求变更记录

- **v1.0 → v1.1（2026-04-25）**：原"1-2句摘要"升级为"摘要 + 五档排名（夯/顶级/人上人/NPC/拉完了）+ 双维度打分"；新增 "有点意思，给我也整一个！" CTA；拉完了档位保留在邮件中；邮件标题风格初稿确认。

## 遇到的问题与修复

| 问题 | 原因 | 修复 |
|---|---|---|
| 本地测试返回 401 | curl 命令使用了占位符 `你的CRON_SECRET` 而非真实值，且 `.env.local` 尚未填写变量 | 填入真实 `CRON_SECRET` 并重启 dev server |

## 交付文件

| 文件 | 说明 |
|---|---|
| `lib/github-trending.ts` | 爬取 GitHub Trending，cheerio 解析，Top 20，支持语言过滤 |
| `lib/email.ts` | `ReviewedRepo` 接口 + HTML 模板（五档颜色分组）+ Resend 发送 |
| `app/api/cron/weekly-digest/route.ts` | 完整 pipeline：爬取→AI batch 评审→发邮件，含 fallback 和 JSON 日志 |
| `vercel.json` | Cron 每周一 09:00 UTC 触发 |
| `.env.local.example` | 新增 `RESEND_API_KEY`、`DIGEST_TO_EMAIL`、`RESEND_FROM`、`CRON_SECRET`、`DIGEST_LANGUAGE_FILTER` |
