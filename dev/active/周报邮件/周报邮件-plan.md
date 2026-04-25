# Phase 3 周报邮件 — 开发计划

> 创建：2026-04-25 | 状态：待开始

---

## 目标

每周一自动爬取 GitHub Trending Top 20，AI 评审 + 五档排名，发邮件。

## 技术方案

### 数据流

```
Vercel Cron (每周一 09:00 UTC)
  → GET /api/cron/weekly-digest
  → lib/github-trending.ts：爬取 Top 20
  → AI batch 调用：一次性评审所有项目，返回 JSON
  → lib/email.ts：按档位分组渲染 HTML 邮件
  → Resend：发送到 DIGEST_TO_EMAIL
```

### 新增文件

| 文件 | 说明 |
|---|---|
| `lib/github-trending.ts` | 爬取 GitHub Trending，返回 TrendingRepo[] |
| `lib/email.ts` | Resend 客户端 + 按档位分组的 HTML 邮件模板 |
| `app/api/cron/weekly-digest/route.ts` | Cron 处理主逻辑 |
| `vercel.json` | Cron 时间表配置 |

### 核心数据结构

```typescript
interface TrendingRepo {
  name: string;        // "owner/repo"
  url: string;
  description: string;
  language: string;
  totalStars: number;
  weeklyStars: number;
}

interface ReviewedRepo {
  name: string;
  url: string;
  summary: string;      // 大白话一句话
  tech_score: number;   // 1-5
  scene_score: number;  // 1-5
  tier: '夯' | '顶级' | '人上人' | 'NPC' | '拉完了';
}
```

### 档位颜色（HTML 邮件）

| 档位 | 背景色 | 文字色 |
|---|---|---|
| 夯 | #CC0000 | #FFFFFF |
| 顶级 | #FF8C00 | #FFFFFF |
| 人上人 | #FFD700 | #000000 |
| NPC | #F5E6C8 | #333333 |
| 拉完了 | #F5F5F5 | #888888 |

### 邮件标题格式

`速通本周 GH 热榜｜{月}/{日} 在火什么玩意 | What the f is Hit in GitHub`

（待用户最终确认，可迭代）

## 环境变量（新增）

```bash
RESEND_API_KEY=
DIGEST_TO_EMAIL=
DIGEST_LANGUAGE_FILTER=   # 可选，逗号分隔语言名
```

## 风险与容错

- GitHub HTML 结构变更 → cheerio 解析失败：try/catch + 报警日志
- AI 返回非法 JSON → fallback 为纯文字摘要邮件（无排名）
- Resend 发送失败 → 记录错误，不重试（Cron 下周再来）
