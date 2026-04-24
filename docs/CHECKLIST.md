# 这他妈是啥？— 任务清单 (CHECKLIST)

> 版本：v1.1 | 最后更新：2026-04-24
> 
> 使用说明：每次开始一个任务前，先读 PRD.md 和 PLAN.md。完成后在对应项打 ✅。

---

## Phase 1：数据库地基

> 目标：笔记本从 localStorage 迁移到 Supabase，跨设备同步。
> 依赖文档：PRD § 二-笔记本、§ 四-认证方案；PLAN § 三、§ 四

### 1.1 Supabase 初始化

- [x] 创建 Supabase 项目（supabase.com）
- [x] 在 SQL Editor 执行 PLAN.md 中的 DDL 建表语句（notes 表 + 索引）
- [x] 复制 `SUPABASE_URL`、`SUPABASE_SERVICE_ROLE_KEY` 到 `.env.local`
- [x] 生成 `ADMIN_SECRET` 写入 `.env.local`
- [x] 生成 `ADMIN_USER_ID` 写入 `.env.local`
- [x] 更新 `.env.local.example` 新增上述变量的注释说明

### 1.2 安装依赖

- [x] `npm install @supabase/supabase-js`

### 1.3 后端基础设施

- [x] 创建 `lib/db.ts` — Supabase 客户端单例（SERVICE_ROLE_KEY，仅服务端）
- [x] 创建 `lib/auth.ts` — `isAuthorized(req)` 函数，校验 `x-admin-secret` header

### 1.4 Notes API

- [x] 创建 `app/api/notes/route.ts`
  - [x] `GET /api/notes` — 查询当前用户所有笔记，支持 `?q=` 搜索
  - [x] `POST /api/notes` — 创建笔记，body 含 inputText / explanation / parentId? / parentText? / source
  - [x] 所有接口先调用 `isAuthorized`，未授权返回 `401`
- [x] 创建 `app/api/notes/[id]/route.ts`
  - [x] `DELETE /api/notes/[id]` — 删除笔记

### 1.5 前端 storage 层改造

- [x] 改造 `lib/storage.ts`：全部 async，调用 Supabase SDK，仅服务端运行
- [x] 新增 `app/actions.ts`：Server Actions 封装，Web 前端通过此层调用，不持有 secret
- [x] Chrome 插件通过 `/api/notes` + `x-admin-secret` 访问（Phase 2 实现）

### 1.6 笔记本页面适配

- [x] 改造 `app/notebook/page.tsx`：调用 server actions，async 数据获取
- [x] 笔记卡片展示 `source` 字段（插件来源显示蓝色"插件"标签）
- [x] 新增 loading 状态、搜索 debounce 300ms

### 1.7 解释 API 鉴权（跳过，个人自用阶段暂不需要）

### 1.8 Phase 1 验收 ✅ 2026-04-24

- [x] 在 Web 端保存一条笔记，在 Supabase 控制台 Table Editor 里能看到这条记录
- [x] 删除一条笔记，Supabase 里对应记录消失
- [x] 搜索笔记能正常工作
- [x] 去掉 `x-admin-secret` header 后，API 返回 401
- [x] 用无痕窗口打开，localStorage 为空但笔记本数据依然正常显示

---

## Phase 2：Chrome 插件

> 目标：在任意网页划词，原地弹出 AI 解释气泡，可一键存入云端笔记本。
> 依赖文档：PRD § 二-模块B；PLAN § 五

### 2.1 插件项目初始化

- [x] 创建 `chrome-extension/` 目录
- [x] 初始化 `package.json`，使用 `@crxjs/vite-plugin@2.0.0`（稳定版）
- [x] 安装依赖：React 18 + Vite 5 + TypeScript
- [x] 创建 `vite.config.ts`（CRXJS manifest-driven 打包）
- [x] 创建 `tsconfig.json`
- [x] 创建 `manifest.json`（Manifest V3，双平台快捷键）

### 2.2 Options 页面

- [x] 创建 `src/options/Options.tsx` — 填写 `apiBaseUrl` 和 `adminSecret` 的表单
- [x] 保存到 `chrome.storage.sync`，读取时回显已保存值

### 2.3 Content Script — 浮动按钮

- [x] Shadow DOM 挂载，`wtf-` 前缀 CSS，完全隔离页面样式
- [x] 选词 → FloatingButton 出现在选词旁边（viewport 边界防溢出）
- [x] 点击外部 / Esc 关闭

### 2.4 Content Script — 解释气泡卡片

- [x] 流式请求 `/api/explain`（绝对 URL）
- [x] loading 状态 + 流式渲染 + 光标动画
- [x] "存入笔记本" → `POST /api/notes`（source: chrome_extension）
- [x] 存成功后按钮变绿色"✓ 已存入笔记本"，失败显示红色提示

### 2.5 Background Service Worker — 快捷键

- [x] 监听 `chrome.commands.onCommand`
- [x] 转发 `WTF_EXPLAIN` 消息给 content script

### 2.6 Web 端 CORS 支持

- [x] 新增 `lib/cors.ts`
- [x] `/api/explain`、`/api/notes`、`/api/notes/[id]` 加 OPTIONS handler + CORS headers

### 2.7 Phase 2 验收 ✅ 2026-04-24

- [x] 在 X.com 选中一段文字，浮动按钮出现在文字旁边
- [x] 点击按钮，气泡卡片出现，AI 解释流式输出
- [x] 按 `Ctrl+Shift+W`（Mac）/ `Alt+W`（Win）快捷键能触发解释
- [x] 点击"存入笔记本"，在 Web 端笔记本里能看到，来源标注"插件"
- [x] 点击卡片外部，卡片消失
- [x] 按 Esc，卡片消失
- [x] Options 填错 secret → 存入失败并提示错误

**需求变更记录：**
- 快捷键由单一 `Alt+W` 改为双平台适配（Mac: `Ctrl+Shift+W`，Win: `Alt+W`）
  - 原因：Mac 上 `Alt+W` 输入特殊字符 `∑`，实测不可用
  - 影响：`manifest.json` + `popup/main.tsx` + `PRD.md`

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
