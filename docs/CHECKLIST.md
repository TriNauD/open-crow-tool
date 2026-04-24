# 这他妈是啥？— 任务清单 (CHECKLIST)

> 版本：v1.0 | 最后更新：2026-04-24
> 
> 使用说明：每次开始一个任务前，先读 PRD.md 和 PLAN.md。完成后在对应项打 ✅。

---

## Phase 1：数据库地基

> 目标：笔记本从 localStorage 迁移到 Supabase，跨设备同步。
> 依赖文档：PRD § 二-笔记本、§ 四-认证方案；PLAN § 三、§ 四

### 1.1 Supabase 初始化

- [ ] 创建 Supabase 项目（supabase.com）
- [ ] 在 SQL Editor 执行 PLAN.md 中的 DDL 建表语句（notes 表 + 索引）
- [ ] 复制 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY`、`SUPABASE_ANON_KEY` 到 `.env.local`
- [ ] 生成 `ADMIN_SECRET`（32位随机字符串）写入 `.env.local`
- [ ] 生成 `ADMIN_USER_ID`（一个固定 UUID）写入 `.env.local`
- [ ] 更新 `.env.local.example` 新增上述变量的注释说明

### 1.2 安装依赖

- [ ] `npm install @supabase/supabase-js`

### 1.3 后端基础设施

- [ ] 创建 `lib/db.ts` — Supabase 客户端单例（SERVICE_ROLE_KEY，仅服务端）
- [ ] 创建 `lib/auth.ts` — `isAuthorized(req)` 函数，校验 `x-admin-secret` header

### 1.4 Notes API

- [ ] 创建 `app/api/notes/route.ts`
  - [ ] `GET /api/notes` — 查询当前用户所有笔记，支持 `?q=` 搜索
  - [ ] `POST /api/notes` — 创建笔记，body 含 inputText / explanation / parentId? / parentText? / source
  - [ ] 所有接口先调用 `isAuthorized`，未授权返回 `401`
- [ ] 创建 `app/api/notes/[id]/route.ts`
  - [ ] `DELETE /api/notes/[id]` — 删除笔记，校验 user_id 归属

### 1.5 前端 storage 层改造

- [ ] 修改 `lib/storage.ts`：将 `getNotes`、`saveNote`、`deleteNote`、`searchNotes` 改为调用 `/api/notes`
  - [ ] 函数签名改为 async
  - [ ] **前端不能直接持有 `ADMIN_SECRET`**。正确方案：`lib/storage.ts` 在服务端调用（Server Actions 或 Server Component），或者在 Next.js Route Handler 内部调用（`/api/notes` 代理到 DB，鉴权在服务端完成）。Web 端不需要传 secret，因为 Web 端请求都经过自己的 Next.js 服务端。
  - [ ] **Chrome 插件**需要 secret（因为它是外部客户端，不经过 Web 服务端），这是唯一例外。
  - [ ] API 失败时 console.error，UI 显示错误提示，不 fallback 到 localStorage（已弃用）

### 1.6 笔记本页面适配

- [ ] 修改 `app/notebook/page.tsx`：`getNotes()` 改为 `await getNotes()`
- [ ] 修改 `app/notebook/page.tsx`：`searchNotes(query)` 改为 `await searchNotes(query)`
- [ ] 笔记卡片展示 `source` 字段（Web / 插件，用小标签区分）

### 1.7 解释 API 鉴权（可选加固）

- [ ] `app/api/explain/route.ts` 加上 `isAuthorized` 校验，防止接口被滥用

### 1.8 Phase 1 验收

- [ ] 在 Web 端保存一条笔记，在 Supabase 控制台 Table Editor 里能看到这条记录
- [ ] 删除一条笔记，Supabase 里对应记录消失
- [ ] 搜索笔记能正常工作
- [ ] 去掉 `x-admin-secret` header 后，API 返回 401
- [ ] 用无痕窗口打开，localStorage 为空但笔记本数据依然正常显示

---

## Phase 2：Chrome 插件

> 目标：在任意网页划词，原地弹出 AI 解释气泡，可一键存入云端笔记本。
> 依赖文档：PRD § 二-模块B；PLAN § 五

### 2.1 插件项目初始化

- [ ] 创建 `chrome-extension/` 目录
- [ ] 初始化 `package.json`（`npm init`）
- [ ] 安装依赖：`npm install -D vite @vitejs/plugin-react typescript`
- [ ] 安装依赖：`npm install react react-dom`
- [ ] 创建 `vite.config.ts`（multi-entry：content、background、options、popup）
- [ ] 创建 `tsconfig.json`
- [ ] 创建 `manifest.json`（Manifest V3，含 commands Alt+W 配置）

### 2.2 Options 页面（先做，插件依赖配置）

- [ ] 创建 `src/options/Options.tsx` — 填写 `apiBaseUrl` 和 `adminSecret` 的表单
- [ ] 保存到 `chrome.storage.sync`
- [ ] 读取时显示已保存的值
- [ ] 配置 `options.html` 入口

### 2.3 Content Script — 浮动按钮

- [ ] 创建 `src/content/index.tsx` — 监听 `mouseup` 事件
- [ ] 判断是否有选中文字（`window.getSelection()`）
- [ ] 有选中文字时：在选中文字旁边渲染 `FloatingButton` 组件
- [ ] 按钮使用橙色样式，内容"这他妈是啥？"
- [ ] 点击外部区域或按 Esc 时隐藏按钮
- [ ] 注意：所有 DOM 注入使用 `wtf-` 前缀 className，样式用 Shadow DOM 隔离

### 2.4 Content Script — 解释气泡卡片

- [ ] 创建 `src/content/ExplainCard.tsx`
  - [ ] 流式请求 `${apiBaseUrl}/api/explain`，带 `x-admin-secret` header
  - [ ] 流式渲染解释文字
  - [ ] 显示 loading 状态
  - [ ] 支持在卡片内再次划词追问
  - [ ] "存入笔记本"按钮 → `POST ${apiBaseUrl}/api/notes`（source: 'chrome_extension'）
  - [ ] 存成功后按钮变绿色显示"已存入"
  - [ ] 点击卡片外部或 Esc 关闭
- [ ] 创建 `src/content/useStreamExplain.ts`（从 Web 端 hook 复制并适配，URL 改为绝对路径）

### 2.5 Background Service Worker — 快捷键

- [ ] 创建 `src/background/index.ts`
- [ ] 监听 `chrome.commands.onCommand`
- [ ] 收到 `explain-selection` 命令时，向当前 tab 的 content script 发送消息
- [ ] Content script 收到消息后，获取当前选中文字并触发解释

### 2.6 构建与打包

- [ ] 配置 `vite.config.ts` 多入口打包
- [ ] `npm run build` 生成 `dist/` 目录
- [ ] 在 Chrome 扩展管理页面（`chrome://extensions`）加载 `dist/` 目录
- [ ] 验证插件可正常加载，无控制台报错

### 2.7 Phase 2 验收

- [ ] 在 X.com 选中一段文字，浮动按钮出现在文字旁边
- [ ] 点击按钮，气泡卡片出现，AI 解释流式输出
- [ ] 按 `Alt+W` 快捷键能触发解释
- [ ] 点击"存入笔记本"，在 Web 端笔记本里能看到这条记录，来源标注"插件"
- [ ] 在气泡卡片内再次划词，能正常追问
- [ ] 点击卡片外部，卡片消失
- [ ] 按 Esc，卡片消失
- [ ] 去 Options 页面填错 secret，保存后触发解释应该失败并提示错误

---

## Phase 3：GitHub Trending 周报邮件

> 目标：每周一自动爬取 GitHub Trending，AI 总结后发邮件。
> 依赖文档：PRD § 二-模块C；PLAN § 六

### 3.1 依赖安装

- [ ] `npm install resend`
- [ ] `npm install cheerio`（HTML 解析）

### 3.2 环境变量

- [ ] 在 `.env.local` 添加 `RESEND_API_KEY`
- [ ] 在 `.env.local` 添加 `DIGEST_TO_EMAIL`
- [ ] 在 `.env.local` 添加 `DIGEST_LANGUAGE_FILTER`（可留空）
- [ ] 更新 `.env.local.example`

### 3.3 GitHub Trending 爬取

- [ ] 创建 `lib/github-trending.ts`
  - [ ] `fetchTrending(language?: string): Promise<TrendingRepo[]>`
  - [ ] 爬取 `https://github.com/trending?since=weekly&l={language}`
  - [ ] 用 cheerio 解析：仓库名、描述、语言、总 star 数、本周新增 star、URL
  - [ ] 返回 Top 20 结构化数组

### 3.4 邮件发送封装

- [ ] 创建 `lib/email.ts`
  - [ ] 封装 Resend 客户端
  - [ ] `sendWeeklyDigest(repos, summaries)` 函数
  - [ ] 邮件 HTML 模板：标题、日期、项目列表（名称 + AI总结 + star数 + 链接）

### 3.5 Cron API Route

- [ ] 创建 `app/api/cron/weekly-digest/route.ts`
  - [ ] `GET` 方法（Vercel Cron 用 GET 触发）
  - [ ] 校验 `CRON_SECRET`（Vercel 自动注入，防止外部随意触发）
  - [ ] 调用 `fetchTrending()`
  - [ ] 将仓库列表批量送 AI 生成一句话总结
  - [ ] 调用 `sendWeeklyDigest()` 发送邮件
  - [ ] 返回执行结果日志

### 3.6 Vercel Cron 配置

- [ ] 创建（或修改）`vercel.json`，添加 cron 配置（每周一 09:00 UTC）

### 3.7 Phase 3 验收

- [ ] 手动 GET `/api/cron/weekly-digest` 能触发完整流程
- [ ] 邮件正常收到，格式可读
- [ ] AI 总结内容准确，不是废话
- [ ] 部署到 Vercel 后，在 Vercel 控制台 Cron Jobs 面板能看到任务已注册
- [ ] 等待下一个周一自动触发后确认邮件到达

---

## 持续任务（每个 Phase 完成时检查）

- [ ] 更新 `README.md`，反映最新的功能和环境变量
- [ ] 确认 `.env.local.example` 包含所有新增变量
- [ ] 检查没有 secret 被 hardcode 进代码（搜索 `ADMIN_SECRET` 字面量）
- [ ] Vercel 环境变量与 `.env.local` 同步（部署前检查）
