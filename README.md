# 这是啥？

> 把任何让你头大的 AI 术语、新工具、震惊体新闻丢进来，用大白话告诉你这玩意儿是干嘛的。

## 功能

- **这是啥** — 粘贴任意文本、链接或术语，流式 AI 大白话解释
- **这又是啥** — 在答案里选中任意词，递归追问，无限套娃
- **这都是啥** — 笔记本，存下问过的东西随时翻

## 快速启动

### 1. 环境变量

```bash
cp .env.local.example .env.local
```

编辑 `.env.local`，选择你的模型提供方：

- OpenAI：`AI_PROVIDER=openai` + `OPENAI_API_KEY`
- 硅基流动：`AI_PROVIDER=siliconflow` + `AI_API_KEY`（模型名需带命名空间，如 `deepseek-ai/DeepSeek-V3`）
- 英伟达 NIM（OpenAI 兼容）：`AI_PROVIDER=nvidia` + `NVIDIA_API_KEY`（或 `AI_API_KEY`），默认 `https://integrate.api.nvidia.com/v1`

**英伟达作备用**：主线路由仍用 siliconflow/openai 等，另设 `NVIDIA_API_KEY`，并打开 `AI_ENABLE_NVIDIA_FALLBACK=true`，主线路由请求失败时会自动用英伟达再试一次。

### 2. 安装依赖

```bash
npm install
```

### 3. 启动开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 技术栈

| 层 | 技术 |
|---|---|
| 框架 | Next.js 16 (App Router) |
| 样式 | Tailwind CSS v4 |
| AI | OpenAI SDK（兼容 OpenAI / SiliconFlow / NVIDIA NIM） |
| 存储 | localStorage (MVP) |
| 部署 | Vercel |

## CI（持续集成）

向 `dev` / `main` **推送**或 **开 PR** 时，GitHub Actions 会自动执行：`npm ci` → `npm run lint` → `npm run test` → `npm run build` → `chrome-extension` 下 `npm ci` + `npm run build`。  
这样能在合并前发现「忘跑测试、类型/ESLint 挂了、Next 或扩展打不出包」等问题；工作流见 [`.github/workflows/ci.yml`](.github/workflows/ci.yml)。构建阶段使用**仅占位**的 Supabase 环境变量（不含真实密钥），与本地用 `.env.local` 不同。

## 目录结构

```
app/
  page.tsx              主页（解释器）
  notebook/page.tsx     笔记本页
  api/explain/route.ts  流式 AI 解释 API
components/
  ExplanationCard.tsx   核心卡片（含递归追问逻辑）
hooks/
  useStreamExplain.ts   流式请求 hook
lib/
  prompts.ts            AI prompt 模板
  ai-providers.ts       多厂商 API 客户端与模型解析
  storage.ts            localStorage 笔记本工具
  cn.ts                 className 工具
```

## 部署到 Vercel

```bash
vercel --prod
```

记得在 Vercel 的环境变量里设置对应 provider 的 key（如 `OPENAI_API_KEY`、`AI_API_KEY`、`NVIDIA_API_KEY` 等）。
