# Phase 3 周报邮件 — 任务清单

> 创建：2026-04-25 | 状态：✅ 用户验收通过 2026-04-25

---

## 3.1 依赖安装

- [x] `npm install cheerio` ✅ 2026-04-25
- [x] 确认 `resend` 已在 dependencies ✅

## 3.2 环境变量

- [x] 在 `.env.local` 添加 `RESEND_API_KEY` ✅
- [x] 在 `.env.local` 添加 `DIGEST_TO_EMAIL` ✅
- [x] 在 `.env.local` 添加 `CRON_SECRET` ✅
- [x] 在 `.env.local` 添加 `DIGEST_LANGUAGE_FILTER`（可留空）✅
- [x] 更新 `.env.local.example` ✅ 2026-04-25

## 3.3 GitHub Trending 爬取

- [x] 创建 `lib/github-trending.ts` ✅ 2026-04-25
  - [x] 定义 `TrendingRepo` 接口
  - [x] `fetchTrending(languageFilter?: string): Promise<TrendingRepo[]>`
  - [x] 用 cheerio 解析：owner/repo、描述、语言、total stars、本周 stars、URL
  - [x] 返回 Top 20，try/catch + 去重

## 3.4 AI 批量评审

- [x] `app/api/cron/weekly-digest/route.ts` AI 调用 ✅ 2026-04-25
  - [x] batch prompt（中文大白话 + tech_score + scene_score + tier）
  - [x] `ReviewedRepo` 接口（定义在 `lib/email.ts`）
  - [x] JSON.parse + 类型校验 + fallback 降级

## 3.5 邮件模板

- [x] 创建 `lib/email.ts` ✅ 2026-04-25
  - [x] `buildEmailHtml()` 按 tier 分组，内联样式
  - [x] 每档位颜色 header（夯=红、顶级=橙、人上人=黄、NPC=米、拉完了=灰）
  - [x] 空档位显示"本周无"
  - [x] "有点意思，给我也整一个！→ [链接]" CTA
  - [x] `sendWeeklyDigest()` Resend 发送

## 3.6 Cron API Route

- [x] `app/api/cron/weekly-digest/route.ts` ✅ 2026-04-25
  - [x] `GET` handler + `export const maxDuration = 60`
  - [x] Bearer token 鉴权
  - [x] fetchTrending → AI review → sendEmail 完整流程
  - [x] 返回 JSON 日志（爬取数、档位分布、发送状态）

## 3.7 Vercel Cron 配置

- [x] 创建 `vercel.json` ✅ 2026-04-25
  - [x] schedule: `0 9 * * 1`（每周一 09:00 UTC）

## 3.8 Phase 3 验收 ✅ 2026-04-25

- [x] 手动 GET `/api/cron/weekly-digest`（带正确 Bearer token）能触发完整流程
- [x] 邮件正常收到，格式按档位分组，颜色正确
- [x] 每个项目有一句话总结 + "有点意思，给我也整一个！"链接
- [x] AI 总结内容准确，档位分布合理
- [x] 去掉 Bearer token 后，API 返回 401

---

> 每完成一步立刻在此处打 ✅。上下文快用完时，先把进度写入本文件再切换。
