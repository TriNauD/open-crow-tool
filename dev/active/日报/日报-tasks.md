# Phase 5：GitHub 日报 — 任务清单

## 5.1 数据库

- [ ] 在 Supabase SQL Editor 执行 DDL：建 `trending_snapshots` 表 + 索引

## 5.2 新增文件

- [ ] `lib/trending-history.ts`
  - [ ] `saveSnapshot(date, repos)` — 存今日快照（upsert）
  - [ ] `loadYesterdaySnapshot()` — 读昨日快照，无则返回 null
  - [ ] `computeDeltas(today, yesterday)` — 计算 RepoWithDelta[]

- [ ] `lib/github-context.ts`
  - [ ] `fetchRepoContext(owner, repo)` — 拉 README（前3000字）+ 最新 Release
  - [ ] 返回 `{ readmeExcerpt, latestRelease }` 或 null（容错）

- [ ] `lib/email-daily.ts`
  - [ ] `buildDailyEmailHtml(topMover, top3, allRepos, date)` — HTML 模板
    - [ ] 昨日之星区块（含 AI 分析）
    - [ ] 今日黑马 TOP 3（含 AI 一句话）
    - [ ] 完整排行榜表格（▲▼★-）
    - [ ] 退订 footer
  - [ ] `sendDailyDigest(data, to, unsubscribeUrl?)` — 发送封装

- [ ] `app/api/cron/daily-digest/route.ts`
  - [ ] Bearer CRON_SECRET 鉴权
  - [ ] fetchTrending('daily')
  - [ ] saveSnapshot + loadYesterdaySnapshot + computeDeltas
  - [ ] 找 top 3 涨幅项目
  - [ ] 并行拉 GitHub context（README + Release）
  - [ ] AI 分析（串行或并行，3 个项目）
  - [ ] 群发所有 active 订阅者
  - [ ] 返回结构化日志

## 5.3 改造文件

- [ ] `vercel.json` — 新增 `{ "path": "/api/cron/daily-digest", "schedule": "0 9 * * *" }`

## 5.4 验收

- [ ] 手动触发 `GET /api/cron/daily-digest`，返回 ok:true
- [ ] 邮件收到，昨日之星、TOP3、完整榜单格式正确
- [ ] ▲▼★ 图例显示正确（需连续跑两天，或手动插入昨日快照测试）
- [ ] AI 分析内容有实质信息（不是套话）
- [ ] 退订链接有效
- [ ] 周报不受影响（周一手动触发周报仍正常）
