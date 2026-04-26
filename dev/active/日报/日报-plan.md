# Phase 5：GitHub 日报 — 开发计划

> 版本：v1.0 | 2026-04-26

---

## 产品定位

**"鸦闻日报"**：每天一封，聚焦变化。用户不需要知道今天 GitHub 有什么，而是需要知道**今天和昨天有什么不同**。

与周报的区别：

| | 日报 | 周报 |
|---|---|---|
| 核心问题 | 今天发生了什么 | 这周什么值得深挖 |
| 阅读时间 | 2 分钟扫一眼 | 10 分钟细读 |
| 主角 | 涨幅最猛的黑马 | 经过评审的质量项目 |
| AI 职责 | 分析为什么今天火了 | 评审档位 + 总结 |

---

## 邮件结构

```
主题：鸦报｜4/26 昨日之星：owner/repo 一夜爆涨 2847 ⭐

━━━ 🌟 昨日之星 ━━━━━━━━━━━━━━━━━━━━━━━

  owner/repo-name          ▲12 → #1 今日排名
  昨日新增 2,847 ⭐

  AI 分析（3-4句）：
  这项目把 LLM 调用封成了状态机...一夜之间冲到榜一...

━━━ 今日黑马 TOP 3 ━━━━━━━━━━━━━━━━━━━━

  ▲7  #2  another/repo     +1,523⭐   AI一句话
  ★   #5  new/entry        +987⭐     AI一句话（新进榜）
  ▲4  #8  third/repo       +756⭐     AI一句话

━━━ 今日完整榜 ━━━━━━━━━━━━━━━━━━━━━━━━

  ▲12  #1   owner/repo          2,847⭐
  ▲7   #2   another/repo        1,523⭐
  ▼3   #3   dropped/one         1,201⭐
  -    #4   steady/project      987⭐
  ★    #5   brand/new           876⭐
  ...（共20条）

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
鸦闻联播 · 每日 17:00 整准时聒噪 | 退订
```

**图例：** ▲ = 上升，▼ = 下降，- = 持平，★ = 新进榜

---

## 数据库新增

```sql
create table trending_snapshots (
  id         uuid primary key default gen_random_uuid(),
  date       date unique not null,  -- 北京时间日期
  repos      jsonb not null,        -- TrendingRepo[] 完整数据
  created_at timestamptz default now()
);
create index trending_snapshots_date_idx on trending_snapshots(date);
```

---

## 新增文件（共 4 个）

| 文件 | 职责 |
|------|------|
| `lib/trending-history.ts` | 存快照、读昨日快照、计算 delta（RepoWithDelta[]） |
| `lib/github-context.ts` | 拉 README + 最新 Release，返回 contextText |
| `lib/email-daily.ts` | 日报 HTML 模板 + sendDailyDigest() |
| `app/api/cron/daily-digest/route.ts` | 日报 cron handler |

**改造文件（共 1 个）：**
- `vercel.json` — 新增每日 cron `"0 9 * * *"`（北京 17:00）

---

## 核心数据结构

```typescript
interface RepoWithDelta {
  name: string;
  url: string;
  description: string;
  language: string;
  totalStars: number;
  dailyStars: number;     // 今日新增
  rank: number;           // 今日排名 1-20
  prevRank: number | null; // 昨日排名，null = 新进榜
  rankChange: number | null; // 正=上升，负=下降，null=新进榜
  isNew: boolean;
}

interface TopMoverContext {
  repo: RepoWithDelta;
  readmeExcerpt: string;   // README 前 3000 字
  latestRelease: string | null; // 最新 release tag + body 前 500 字
  aiAnalysis: string;      // 3-4 句话为什么火
}
```

---

## AI 调用策略

**对象：** 涨幅 top 3（rankChange 最大的 3 个，或新进 top 5 的新项目）

**数据来源：**
1. `https://raw.githubusercontent.com/{owner}/{repo}/main/README.md`（取前 3000 字符）
2. `https://api.github.com/repos/{owner}/{repo}/releases/latest`（无需 token，60次/小时）

**Prompt 设计：**
```
你是"鸦闻日报"的编辑，风格：接地气、幽默、口语化，偶尔贱贱的，不装。

项目：{name}
描述：{description}
今日新增 star：{dailyStars}
排名变化：从 #{prevRank} 升至 #{rank}（+{change}位）
README 摘要：{readmeExcerpt}
最新 Release：{latestRelease 或 "暂无"}

用3-4句中文口语分析为什么这项目今天突然火了。
不要废话，直接说。如果有新release就提，没有就猜技术原因或场景原因。
```

**容错：** README 拉不到 → 只用描述；AI 调用失败 → 只展示数据不展示分析

---

## Cron 逻辑

```
每天 09:00 UTC（北京 17:00）
  1. fetchTrending('daily') — 拉今日日榜
  2. saveSnapshot(today, repos) — 存今日快照
  3. loadYesterdaySnapshot() — 读昨日快照
  4. computeDeltas(today, yesterday) — 计算 ▲▼
  5. 找出 top 3 涨幅最大项目
  6. 并行拉 README + Release（3个项目 = 6次HTTP）
  7. AI batch 或串行分析 top 3
  8. sendDailyDigest() — 群发所有 active 订阅者
  9. 返回日志
```

---

## 边缘情况

| 情况 | 处理 |
|------|------|
| 第一次跑，无昨日数据 | 全部显示 ★，不展示 AI 分析（无对比无依据） |
| README 超长 | 截取前 3000 字符 |
| 无 README | 用 description 代替 |
| 无 Release | AI 提示中注明"暂无新版本" |
| GitHub API 限速（60次/小时） | 3 个项目 × 2 = 6 次，远低于限制 |
| AI 分析失败 | 该项目只展示数据，不展示分析，不影响其他项目 |

---

## 不在范围内（Phase 5 不做）

- 订阅频率偏好（日报/周报分开订阅）→ Phase 6
- SNS 讨论汇总（X/Reddit）→ Phase N
- 多平台（HN/Reddit）→ Phase N
- 邮件模板A/B测试 → Phase N
