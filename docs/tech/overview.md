## 一、整体架构

```
┌──────────────────────────────────────────────────────────────┐
│                          用户入口                              │
│   Web (Next.js)                 Chrome Extension (Vite)       │
│   登录态 Bearer JWT；「连接插件」   存笔记：Bearer（与 Web 一致）   │
│   postMessage → storage.sync      （`accessToken` + `apiBaseUrl`）│
└──────────┬─────────────────────────────┬──────────────────────┘
           │                             │
           ▼                             ▼
┌──────────────────────────────────────────────────────────────┐
│                Next.js API Routes (Vercel)                    │
│  /api/explain   /api/notes   /api/notes/[id]                 │
│  /api/notes/migrate-guest    /api/cron/weekly-digest          │
│  ↑ Web 笔记 API：Bearer JWT → getRequestUser() 校验           │
└──────────┬─────────────────────────────┬──────────────────────┘
           │                             │
           ▼                             ▼
    ┌─────────────┐      ┌──────────────────────────────┐
    │  AI Provider │      │       Supabase Postgres       │
    │  (OpenAI /   │      │  notes 表（RLS 行级隔离 ✅）   │
    │  SiliconFlow)│      │  subscribers 表               │
    └─────────────┘      └──────────────────────────────┘
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

