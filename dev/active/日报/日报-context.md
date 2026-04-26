# Phase 5：GitHub 日报 — 上下文

## 背景

Phase 3 完成了周报（夯拉排行榜），Phase 4 打通了外部订阅。
Phase 5 在周报基础上新增日报产品线，两者完全独立。

## 关键设计决策

1. **日报 ≠ 周报的频率变体**：两者是不同产品。日报卖"变化感知"，周报卖"质量筛选"。
2. **不动现有代码**：周报 cron、email.ts、所有现有文件一行不改。
3. **历史数据是核心**：`trending_snapshots` 表是日报的地基，没有它就算不出 ▲▼。
4. **AI 分析用 README + Release**：不用纯猜，有具体依据。分析的是"有依据的推测"，不是事实。
5. **GitHub 无需认证 API**：60次/小时足够（每天只用 6 次）。
6. **订阅者不区分频率**：Phase 5 阶段所有 active 订阅者同时收日报和周报。频率偏好是 Phase 6 的事。

## 与现有架构的关系

- `lib/github-trending.ts` → Phase 5 新增 `fetchTrending('daily')` 调用，已支持 since 参数
- `lib/db/client.ts` → 复用 Supabase 单例
- `lib/db/subscribers.ts` → 复用 getActiveSubscribers()
- `app/api/cron/weekly-digest/route.ts` → 完全不动
- `vercel.json` → 新增一行 daily cron
