# 这是啥？

> 把任何让你头大的 AI 术语、新工具、震惊体新闻丢进来，用大白话告诉你这玩意儿是干嘛的。

## 功能

- **这是啥** — 粘贴任意文本、链接或术语，流式 AI 大白话解释
- **这又是啥** — 在答案里选中任意词，递归追问
- **这都是啥** — 笔记本（登录用户云端同步；未登录可用游客态本地暂存）

更完整的产品见 **[`docs/PRD.md`](docs/PRD.md)**（总览）与分卷 **[`docs/product/`](docs/product/README.md)**；技术见 **[`docs/PLAN.md`](docs/PLAN.md)** 与分卷 **[`docs/tech/`](docs/tech/README.md)**；任务级清单见 **[`docs/CHECKLIST.md`](docs/CHECKLIST.md)**。

---

## 快速启动

### 1. 环境变量

```bash
cp .env.local.example .env.local
```

按 `.env.local.example` 注释配置 AI 提供方（如 `AI_PROVIDER`、`AI_API_KEY`）及 Supabase 等；生产/预览环境在 Vercel 面板配置同名变量。

### 2. 安装与开发

```bash
npm ci
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。团队约定 Node / npm 版本见 `.nvmrc` 与 `package.json` 的 `engines`。

### 3. 合并前自检（与 CI 一致）

```bash
npm run verify
```

顺序执行：`lint` → `test`（Vitest）→ Next 生产构建（无 `.env.local` 时使用**仅占位**的 Supabase 变量，与 [`.github/workflows/ci.yml`](.github/workflows/ci.yml) 一致）→ `chrome-extension` 下 `npm ci` 与扩展构建。脚本实现见 [`scripts/verify.mjs`](scripts/verify.mjs)。

单独跑测试：`npm run test`；监听模式：`npm run test:watch`。

---

## 技术栈（摘要）

| 层 | 技术 |
|---|---|
| Web | Next.js（App Router）、React、Tailwind CSS v4 |
| 数据与身份 | Supabase（Postgres + Auth），笔记多用户与 RLS |
| AI | OpenAI 兼容 SDK（多厂商路由见 `lib/ai/`） |
| 扩展 | `chrome-extension/`，Vite + React（Manifest V3） |
| 部署 | Vercel |

---

## CI

向 `dev` / `main` **推送**或 **开 PR** 时，GitHub Actions 跑与 `npm run verify` 等价的步骤（依赖安装用 `npm ci`）。工作流见 [`.github/workflows/ci.yml`](.github/workflows/ci.yml)。

---

## 部署（Vercel）

```bash
vercel --prod
```

在 Vercel 中配置与 `.env.local.example` 对应的环境变量。若发版同时涉及 **网站 API / CORS 与扩展**，需确认**两端**均已部署/重装扩展，避免只更新一边导致跨域或鉴权异常。

---

## 仓库与目录

应用代码主要在 `app/`、`components/`、`lib/`；Chrome 扩展在 **`chrome-extension/`**（独立 `package.json`）。开发过程与结项文档在 **`dev/`** 下。模块级结构说明见 **`docs/tech/`** 分卷，避免在 README 维护易过时的树状列表。
