## 六、Phase 3：周报邮件

> 需求变更 v1.1（2026-04-25）：由"批量摘要"升级为"批量评审 + 五档排名"。

### 新增文件

```
新增：
  app/api/cron/weekly-digest/route.ts  — Vercel Cron 触发的处理函数
  lib/github-trending.ts               — 爬取 GitHub Trending
  lib/email.ts                         — Resend 邮件发送封装（按档位分组模板）
  vercel.json                          — 配置 Cron 时间表
```

### GitHub Trending 爬取

```
fetch('https://github.com/trending?since=weekly')
  → 解析 HTML（用 cheerio）
  → 提取：owner/repo、描述、语言、total stars、本周新增 star、repo URL
  → 返回 TrendingRepo[] 结构化数组（Top 20）
```

注意：GitHub 没有 robots.txt 限制 trending 页面，可以直接爬。

### AI 评审方案（核心变更）

**一次 batch 调用**，把所有 Top 20 项目喂给 AI，要求返回 JSON 数组。
比 20 个独立调用省约 90% token，延迟也低。

**输出数据结构：**

```typescript
interface ReviewedRepo {
  name: string;         // "owner/repo"
  url: string;          // "https://github.com/owner/repo"
  summary: string;      // 一句话大白话总结
  tech_score: number;   // 1-5，技术创新性
  scene_score: number;  // 1-5，场景创新性
  tier: '夯' | '顶级' | '人上人' | 'NPC' | '拉完了';
}
```

**Prompt 核心要求：**
- 用中文大白话，一句话说清楚这玩意是干嘛的
- tech_score：技术实现有没有创新，1=纯 CRUD，5=颠覆性
- scene_score：解决的问题场景有没有价值，1=没人需要，5=所有人都需要
- tier 由 AI 根据综合判断自由归档，不硬编码分数映射
- 严格返回 JSON，不输出多余内容

**容错：** JSON.parse 失败时 fallback 为无排名的纯摘要邮件。

### 邮件模板结构

```
主题：速通本周 GH 热榜｜X月X日在火什么玩意 | What the f is Hit in GitHub

━━━ 🔥 夯 ━━━━━━━━━━━━━━━━━━━━━
• owner/repo
  一句话总结
  有点意思，给我也整一个！→ https://github.com/xxx

━━━ 顶级 ━━━━━━━━━━━━━━━━━━━━━━
• ...

━━━ 人上人 ━━━━━━━━━━━━━━━━━━━━━
• ...

━━━ NPC ━━━━━━━━━━━━━━━━━━━━━━━
• ...

━━━ 拉完了 ━━━━━━━━━━━━━━━━━━━━━
• ...（全部保留，不裁剪）
```

档位颜色（HTML 邮件）：夯=红(#CC0000)、顶级=橙(#FF8C00)、人上人=黄(#FFD700)、NPC=米(#F5E6C8)、拉完了=白底灰字

### vercel.json

```json
{
  "crons": [{
    "path": "/api/cron/weekly-digest",
    "schedule": "0 9 * * 1"
  }]
}
```

（每周一 09:00 UTC 触发，即北京时间 17:00）

### 新增环境变量

```bash
RESEND_API_KEY=xxxx
DIGEST_TO_EMAIL=你的邮箱
DIGEST_LANGUAGE_FILTER=   # 可选，如 "TypeScript,Python"，空则不过滤
```

