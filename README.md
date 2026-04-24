# 这他妈是啥？

> 把任何让你头大的 AI 术语、新工具、震惊体新闻丢进来，用大白话告诉你这玩意儿是干嘛的。

## 功能

- **这他妈是啥** — 粘贴任意文本、链接或术语，流式 AI 大白话解释
- **这他妈又是啥** — 在答案里选中任意词，递归追问，无限套娃
- **这他妈都是啥** — 笔记本，存下问过的东西随时翻

## 快速启动

### 1. 环境变量

```bash
cp .env.local.example .env.local
```

编辑 `.env.local`，选择你的模型提供方：

- OpenAI：`AI_PROVIDER=openai` + `OPENAI_API_KEY`
- DeepSeek：`AI_PROVIDER=deepseek` + `DEEPSEEK_API_KEY`

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
| AI | OpenAI SDK（兼容 OpenAI / DeepSeek） |
| 存储 | localStorage (MVP) |
| 部署 | Vercel |

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
  storage.ts            localStorage 笔记本工具
  cn.ts                 className 工具
```

## 部署到 Vercel

```bash
vercel --prod
```

记得在 Vercel 的环境变量里设置对应 provider 的 key（`OPENAI_API_KEY` 或 `DEEPSEEK_API_KEY`）。
