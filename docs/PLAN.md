# 这他妈是啥？— 技术架构与执行计划 (PLAN)

> 版本：v1.1 | 作者：TL | 最后更新：2026-04-26

---

## 一、整体架构

```
┌─────────────────────────────────────────────────────┐
│                     用户入口                          │
│   Web (Next.js)          Chrome Extension (Vite)     │
└──────────┬──────────────────────┬────────────────────┘
           │                      │
           ▼                      ▼
┌─────────────────────────────────────────────────────┐
│              Next.js API Routes (Vercel)              │
│  /api/explain   /api/notes   /api/cron/weekly-digest  │
│         ↑ 所有请求带 x-admin-secret header            │
└──────────┬──────────────────────┬────────────────────┘
           │                      │
           ▼                      ▼
    ┌─────────────┐      ┌───────────────────┐
    │  AI Provider │      │  Supabase Postgres │
    │  (OpenAI /   │      │  (notes 表)        │
    │  SiliconFlow)│      └───────────────────┘
    └─────────────┘
```

---

## 二、技术选型

| 层 | 技术 | 理由 |
|---|---|---|
| Web 框架 | Next.js (App Router) | 现有，不换 |
| 样式 | Tailwind CSS v4 | 现有，不换 |
| AI | 现有 ai-providers.ts | 现有，不换 |
| 数据库 | Supabase Postgres | Auth + DB 一体，免费层足够，JS SDK 友好 |
| Chrome 插件 | Vite + React + TypeScript | 与 Web 技术栈一致，复用组件逻辑 |
| 邮件 | Resend | 免费 3000 封/月，API 极简 |
| Cron | Vercel Cron | 免费，配置简单，在 vercel.json 声明 |
| 部署 | Vercel | 现有 |

---

## 三、数据库设计

### Supabase 初始化

1. 创建 Supabase 项目
2. 在 SQL Editor 执行建表语句
3. 将连接串写入 `.env.local`

### DDL（在 Supabase SQL Editor 执行）

```sql
-- notes 表
create table if not exists notes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,           -- 当前阶段固定常量，预留多用户
  input_text  text not null,
  explanation text not null,
  parent_id   uuid references notes(id) on delete set null,
  parent_text text,
  source      text default 'web',      -- 'web' | 'chrome_extension'
  saved_at    timestamptz default now(),
  tags        text[] default '{}'
);

-- 按 user_id 查询的索引
create index if not exists notes_user_id_idx on notes(user_id);
-- 全文搜索索引（中英文都支持）
create index if not exists notes_fts_idx
  on notes using gin(to_tsvector('simple', input_text || ' ' || explanation));
```

### 环境变量新增

```bash
# Supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=xxxx   # 后端专用，不暴露给前端
SUPABASE_ANON_KEY=xxxx           # 可选，暂时用不到

# 鉴权（B方案）
ADMIN_SECRET=你自己设置的随机字符串（建议 32 位）
ADMIN_USER_ID=一个固定 UUID（建议用 crypto.randomUUID() 生成一次后写死）
```

---

## 四、Phase 1：数据库地基

### 改动文件清单

```
新增：
  lib/db.ts                  — Supabase 客户端单例
  lib/auth.ts                — 校验 x-admin-secret 的中间件函数
  app/api/notes/route.ts     — Notes CRUD API

修改：
  lib/storage.ts             — 保留 localStorage 接口不变，内部调用改为 fetch API
                               （降级策略：API 失败时 fallback 到 localStorage）
  app/api/explain/route.ts   — 加上 auth 校验（可选，防止 API 被滥用）
  .env.local.example         — 新增 Supabase 和 ADMIN_SECRET 变量注释

不改：
  components/ExplanationCard.tsx  — storage 接口不变，无感知
  app/notebook/page.tsx           — 数据来源从 localStorage 自动切到 API
  hooks/useStreamExplain.ts       — 不动
```

### lib/db.ts 核心逻辑

```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const db = createClient(supabaseUrl, supabaseKey);
```

### lib/auth.ts 核心逻辑

```typescript
import { NextRequest } from 'next/server';

export function isAuthorized(req: NextRequest): boolean {
  const secret = req.headers.get('x-admin-secret');
  return secret === process.env.ADMIN_SECRET;
}
```

### /api/notes/route.ts 接口规范

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/notes?q=搜索词` | 获取/搜索笔记列表 |
| `POST` | `/api/notes` | 创建笔记 |
| `DELETE` | `/api/notes/[id]` | 删除笔记 |

所有接口需要 `x-admin-secret` header，否则返回 `401`。

### lib/storage.ts 改造策略

保持现有函数签名完全不变（`getNotes`, `saveNote`, `deleteNote`, `searchNotes`），
内部实现从 `localStorage` 改为调用 Supabase JS SDK（`db` 客户端）。

**重要：`lib/storage.ts` 只在服务端运行（Server Actions 或 API routes 内部调用），
不被 `'use client'` 组件直接 import。**

架构分层：
```
'use client' 组件
    ↓  fetch
Next.js Route Handler (/api/notes)    ← isAuthorized 在这里
    ↓  直接调用
lib/storage.ts (db client, 服务端)
    ↓
Supabase Postgres
```

对于 `getNotes()` 和 `searchNotes()` 这类需要异步的函数，改为 `async`，
调用方 (API route) 相应加 `await`。

---

## 五、Phase 2：Chrome 插件

### 目录结构

```
chrome-extension/
  manifest.json
  src/
    content/
      index.tsx          — content script 入口，监听选词事件
      FloatingButton.tsx — 选词后出现的橙色按钮
      ExplainCard.tsx    — 解释气泡卡片（复用 Web 端逻辑）
      useStreamExplain.ts — 复制自 hooks/，调整 fetch URL 为绝对路径
    background/
      index.ts           — service worker，处理 Alt+W 快捷键
    options/
      index.tsx          — Options 页面，填写 ADMIN_SECRET 和 API URL
      Options.tsx
    popup/
      index.tsx          — 点击插件图标的小 popup（非主要功能）
  vite.config.ts
  tsconfig.json
  package.json
```

### manifest.json 关键配置

```json
{
  "manifest_version": 3,
  "name": "这他妈是啥？",
  "permissions": ["storage", "activeTab", "scripting", "commands"],
  "commands": {
    "explain-selection": {
      "suggested_key": { "default": "Alt+W" },
      "description": "解释选中文字"
    }
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["src/content/index.js"]
  }],
  "options_ui": {
    "page": "options.html",
    "open_in_tab": true
  }
}
```

### 插件交互逻辑

```
用户选中文字
    ├── 浮动按钮出现（选中文字旁边，用 getBoundingClientRect 定位）
    │       └── 点击按钮 → 触发解释
    └── 按 Alt+W → background service worker → 发消息给 content script → 触发解释

触发解释：
    → 获取选中文字
    → 在选中文字旁边挂载 ExplainCard 组件（React Portal）
    → fetch 到 Web 端 /api/explain（URL 从 chrome.storage.sync 读取）
    → 流式渲染解释内容
    → 用户点"存入笔记本" → fetch /api/notes（带 ADMIN_SECRET）
    → 用户点击卡片外部 / 按 Esc → 卸载卡片
```

### 鉴权配置存储

```typescript
// chrome.storage.sync 存储结构
interface ExtensionConfig {
  apiBaseUrl: string;   // e.g. https://your-app.vercel.app
  adminSecret: string;  // ADMIN_SECRET 的值
}
```

---

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

---

## 七、Phase 4：外部订阅接入

### 新增文件

```
新增：
  lib/db/subscribers.ts               — 订阅者 CRUD（createSubscriber / getActiveSubscribers / cancelByToken）
  app/api/subscribe/route.ts          — POST，邮箱去重入库，status 直接 active
  app/subscribe/page.tsx              — 订阅落地页（client component，表单提交）
  app/api/unsubscribe/route.ts        — GET ?token=xxx → 标记 cancelled → redirect
  app/unsubscribe/page.tsx            — 退订确认页（server component，await searchParams）

改造：
  lib/email.ts                        — sendWeeklyDigest(repos, to, unsubscribeUrl?) 新签名
  app/api/cron/weekly-digest/route.ts — 群发所有 active 订阅者，DIGEST_TO_EMAIL 保留作管理员兜底
  .env.local.example                  — 加入 DDL 注释（无新环境变量）
```

### DB DDL（在 Supabase SQL Editor 执行）

```sql
create table subscribers (
  id                     uuid primary key default gen_random_uuid(),
  email                  text unique not null,
  status                 text default 'active',   -- active/cancelled
  stripe_customer_id     text,                    -- Phase 5 预留
  stripe_subscription_id text,                    -- Phase 5 预留
  unsubscribe_token      uuid default gen_random_uuid(),
  subscribed_at          timestamptz default now(),
  cancelled_at           timestamptz
);
create index subscribers_status_idx on subscribers(status);
create index subscribers_unsubscribe_token_idx on subscribers(unsubscribe_token);
```

### 关键架构设计

```
用户 → POST /api/subscribe → lib/db/subscribers.ts → Supabase subscribers 表
                                                              ↑
Vercel Cron → GET /api/cron/weekly-digest
  → getActiveSubscribers() 查询所有 active 订阅者
  → 逐一调用 sendWeeklyDigest(reviewed, sub.email, unsubscribeUrl)
  → 同时发给 DIGEST_TO_EMAIL（管理员兜底，无退订链接）

用户点退订链接 → GET /api/unsubscribe?token=xxx
  → cancelByToken(token) 标记 cancelled
  → 重定向到 /unsubscribe?status=success
```

### 无新增环境变量

退订链接的 baseUrl 从 `new URL(req.url).origin` 动态获取，无需硬编码。

---

## 八、代码规范与约束

1. **绝对不能做的事**：
   - 不能把 `SUPABASE_SERVICE_ROLE_KEY` 或 `ADMIN_SECRET` 暴露给客户端代码（不能出现在 `'use client'` 组件或任何会打包到前端的文件里）
   - 不能跳过 `isAuthorized` 校验直接操作 DB

2. **API 规范**：
   - 所有写操作必须先鉴权
   - 返回格式统一：`{ data: T } | { error: string }`

3. **Chrome 插件规范**：
   - content script 要尽量轻量，不要加载不必要的库
   - 注入的 DOM 元素用唯一 className 前缀 `wtf-` 避免与页面冲突
   - 所有样式用 Shadow DOM 隔离，防止被页面 CSS 污染

4. **PM 审查点（每个 Phase 完成后必须验证）**：
   - [ ] 笔记本数据是否真的存到了 Supabase（不是 localStorage）
   - [ ] 插件保存的笔记是否在 Web 端笔记本里能看到
   - [ ] 鉴权是否真的在工作（去掉 header 应该返回 401）
   - [ ] 周报邮件格式是否可读，总结是否准确

---

## 九、里程碑时间线（参考）

| 里程碑 | 目标 | 预计周期 |
|---|---|---|
| M1 | Phase 1 完成，笔记本云端同步 | 1 周 |
| M2 | Phase 2 完成，Chrome 插件可用 | 2 周 |
| M3 | Phase 3 完成，周报邮件运行 | 按兴趣，随时加 |
| M4 | Phase 4 完成，外部用户可订阅 | 2026-04-25 ✅ |
