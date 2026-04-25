# 工作总结 — Phase 1 & Phase 2

> 项目：what-the-f-tool
> 时间：2026-04-24
> 参与：PM / TL / Coder

---

## Phase 1：数据库地基

**目标**：把玩具级的 `localStorage` 笔记本换成云端持久化，为后续 Chrome 插件和多端同步打好地基。

### 交付内容

| 文件 | 类型 | 说明 |
|------|------|------|
| `lib/db/client.ts` | 新增 | Supabase 客户端单例 |
| `lib/utils/auth.ts` | 新增 | `isAuthorized()` 校验 `x-admin-secret` header |
| `lib/db/notes.ts` | 改造 | 笔记 CRUD 全部改为 async，走 Supabase Postgres，含 `user_id` 字段 |
| `app/actions.ts` | 新增 | Server Actions 封装（4个：get / save / delete / search） |
| `app/api/notes/route.ts` | 新增 | REST API：GET + POST，供 Chrome 插件调用，需 secret |
| `app/api/notes/[id]/route.ts` | 新增 | REST API：DELETE，供 Chrome 插件调用 |
| `components/ExplanationCard.tsx` | 改造 | `handleSave` 改为 async，调用 `saveNoteAction` |
| `app/notebook/page.tsx` | 改造 | 改用 Server Actions，新增 loading 状态、搜索 debounce、来源标签 |
| `.env.local.example` | 更新 | 新增 Supabase + 鉴权变量文档 |

### 关键架构设计

```
Web 前端 ──→ Server Actions ──→ lib/db/notes.ts ──→ Supabase
                                                         ↑
Chrome 插件 ──→ /api/notes (REST + x-admin-secret) ──→ 同一个 DB
```

Web 端走 Server Actions，`ADMIN_SECRET` 和 `SUPABASE_SERVICE_ROLE_KEY` 永不出服务端边界。  
插件端走 REST API，外部客户端必须携带 secret header。  
DB schema 预留 `user_id` 字段，为将来多用户迁移零改造成本。

### 验收结论

✅ 用户验收全部通过

---

## Phase 2：Chrome 划词插件

**目标**：解决用户"看技术文章要切标签页去查词"的痛点，实现原地划词、原地解释、一键收藏。

### 交付内容

**Web App 侧（CORS 支持）**

| 文件 | 类型 | 说明 |
|------|------|------|
| `lib/utils/cors.ts` | 新增 | CORS 常量 + `handleOptions()` |
| `app/api/explain/route.ts` | 改造 | 加 OPTIONS handler + CORS headers（streaming 响应） |
| `app/api/notes/route.ts` | 改造 | 加 OPTIONS handler + CORS headers |
| `app/api/notes/[id]/route.ts` | 改造 | 加 OPTIONS handler + CORS headers |

**Chrome 插件（`chrome-extension/`）**

| 文件 | 说明 |
|------|------|
| `manifest.json` | MV3，双平台快捷键：Mac = `Ctrl+Shift+W`，Win/Linux = `Alt+W` |
| `vite.config.ts` | Vite + @crxjs/vite-plugin 2.0.0（稳定版） |
| `src/content/index.tsx` | Shadow DOM 挂载入口，样式完全隔离于宿主页 |
| `src/content/App.tsx` | 选词状态管理、快捷键消息监听、组件调度 |
| `src/content/FloatingButton.tsx` | 橙色浮动按钮，动态定位，viewport 边界防溢出 |
| `src/content/ExplainCard.tsx` | 解释气泡卡片，流式输出，一键存笔记本，Esc/外部点击关闭 |
| `src/content/useStreamExplain.ts` | 流式请求 hook，接受 `apiBaseUrl` 参数构造绝对 URL |
| `src/content/styles.ts` | 注入 Shadow DOM 的 CSS 字符串 |
| `src/background/index.ts` | Service Worker，监听快捷键命令并转发给 content script |
| `src/options/Options.tsx` | 配置页：`apiBaseUrl` + `adminSecret` → `chrome.storage.sync` |
| `src/popup/main.tsx` | 弹窗：配置状态提示 + 平台感知快捷键显示 |
| `.gitignore` | 排除 `node_modules/` 和 `dist/` |

### 关键架构设计

- **Shadow DOM 隔离**：content script UI 挂在独立 shadow root，宿主页 CSS 完全不干扰
- **流式响应**：直接对接 `/api/explain` 的 SSE 流，解释结果逐字出现
- **双平台快捷键**：manifest `suggested_key` 分别指定 `default` 和 `mac`，popup 文案用 `navigator.platform` 动态切换
- **配置持久化**：API URL 和 secret 存 `chrome.storage.sync`，跨设备同步

### 遇到的问题与修复

| 问题 | 原因 | 修复 |
|------|------|------|
| 插件请求报"网炸了" | CORS headers 未部署到 Vercel | conditional signoff 提前推送 CORS 改动 |
| Mac `Alt+W` 输出 `∑` | Mac 的 Alt 键是特殊字符输入键 | manifest 增加 `"mac": "MacCtrl+Shift+W"` |
| `node_modules/dist` 被 commit | chrome-extension 下无独立 `.gitignore` | 补 `.gitignore` + `git rm --cached` |
| @crxjs beta 版 deprecated | 使用了 beta.26 版本 | 升级至 stable 2.0.0 |

### 验收结论

✅ 用户验收全部通过

---

## Phase 0 → Phase 2 整体交付

| 能力 | Phase 0 (MVP) | Phase 1 + 2 (本次) |
|------|--------------|-------------------|
| 解释入口 | Web 页面输入框 | Web 页面 + Chrome 划词浮窗 |
| 笔记存储 | 浏览器 localStorage | Supabase Postgres 云端持久化 |
| 跨设备同步 | ❌ | ✅ |
| 笔记来源区分 | ❌ | ✅（Web / 插件标签） |
| AI 后端 | 单一 OpenAI | 多后端（OpenAI / SiliconFlow / NVIDIA NIM + fallback） |
| 部署 | Vercel | Vercel（main 分支自动 CI/CD） |

---

---

## Phase 3：GitHub Trending 周报邮件

**目标**：每周一自动爬取 GitHub Trending Top 20，AI 五档评审，发 HTML 邮件。

### 交付内容

| 文件 | 类型 | 说明 |
|------|------|------|
| `lib/github-trending.ts` | 新增 | cheerio 爬取 GitHub Trending，支持语言过滤，返回 Top 20 |
| `lib/email.ts` | 新增 | `ReviewedRepo` 接口 + 五档颜色 HTML 模板 + Resend 发送封装 |
| `app/api/cron/weekly-digest/route.ts` | 新增 | GET handler，Bearer 鉴权，爬取→AI batch 评审→发邮件，含 fallback |
| `vercel.json` | 新增 | Cron 配置，每周一 09:00 UTC（北京时间 17:00）触发 |
| `.env.local.example` | 更新 | 新增 `RESEND_API_KEY`、`DIGEST_TO_EMAIL`、`RESEND_FROM`、`CRON_SECRET` |

### 关键架构设计

```
Vercel Cron (每周一 09:00 UTC)
  → GET /api/cron/weekly-digest (Bearer CRON_SECRET)
  → lib/github-trending.ts：cheerio 爬取 Top 20
  → AI 单次 batch 调用：评审所有项目，返回 JSON（摘要 + 双维度分 + 五档位）
  → lib/email.ts：按档位分组渲染 HTML 邮件
  → Resend：发送到 DIGEST_TO_EMAIL
```

- **五档排名**：夯 → 顶级 → 人上人 → NPC → 拉完了，AI 自由判断档位
- **双维度打分**：技术创新性 + 场景创新性各 1-5 分
- **CTA 文案**：每个项目附 "有点意思，给我也整一个！→ [链接]"
- **容错**：AI JSON 解析失败时 fallback 为无排名纯摘要邮件

### 需求变更

- v1.1（2026-04-25）：原"1-2句摘要"升级为"摘要 + 五档排名 + 双维度打分"；拉完了档位保留；邮件标题风格初稿确认

### 验收结论

✅ 用户验收全部通过（2026-04-25）

---

## Phase 0 → Phase 3 整体交付

| 能力 | Phase 0 (MVP) | Phase 1+2 | Phase 3 |
|------|--------------|-----------|---------|
| 解释入口 | Web 页面输入框 | Web + Chrome 划词浮窗 | — |
| 笔记存储 | localStorage | Supabase Postgres 云端 | — |
| 跨设备同步 | ❌ | ✅ | — |
| 周报推送 | ❌ | ❌ | ✅ Vercel Cron + Resend |
| AI 评审排名 | ❌ | ❌ | ✅ 五档 + 双维度打分 |

---

## 遗留与下一步

- 详细待办见 `docs/CHECKLIST.md`
- 技术方案见 `docs/PLAN.md`
