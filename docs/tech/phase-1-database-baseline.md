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

