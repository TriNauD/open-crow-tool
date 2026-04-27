# 这他妈是啥？— 产品需求文档 (PRD)

> 版本：v1.3 | 作者：PM | 最后更新：2026-04-27

---

## 一、产品定位

**一句话**：把任何让你头大的 AI 术语、新工具、技术文章，用大白话解释清楚，并帮你系统积累。

**目标用户（当前阶段）**：开发者/技术从业者，频繁刷 X / HN / GitHub，需要随时搞懂陌生术语，但不想离开当前页面去 Google 或切换标签页。

**商业模式（当前阶段）**：个人自用 → 开放外部订阅周报（Phase 4 ✅）→ 周报生产就绪（✅）→ 付费订阅制（Phase 5）。

---

## 二、三大功能模块

### 模块 A：Web 解释器（已有 MVP）

用户在网站上输入或粘贴任意文字/链接，AI 用大白话流式返回解释。

**核心功能：**
- 文本输入 + 流式 AI 解释
- 在答案中划词递归追问（"这他妈又是啥"）
- 解释结果存入笔记本（云端持久化）
- 笔记本支持搜索、查看、删除

**体验要求：**
- 响应要快，流式输出不能卡
- 移动端可用（但不是重点优化对象）
- UI 简洁，信息密度合适，不花哨

---

### 模块 B：Chrome 划词插件（Phase 2 核心）

用户在任意网页（重点：X、GitHub、技术博客）划词，原地弹出 AI 解释气泡卡片，无需切换标签页。

**触发方式（已确认）：**
- 选中文字 → 自动出现橙色浮动按钮
- 同时支持键盘快捷键：Windows/Linux `Alt+W`，Mac `Ctrl+Shift+W`

**弹出卡片位置（已确认）：**
- 悬浮在选中文字旁边（就近显示）

**卡片功能：**
- 流式显示 AI 解释（复用 `/api/explain` 接口）
- 卡片内可再次划词递归追问
- 一键"存入笔记本"（同步到云端，与 Web 端共享）
- 支持关闭卡片（点击外部区域 / 按 Esc）

**鉴权：**
- 插件 Options 页面填写一次 `ADMIN_SECRET`
- 存入 `chrome.storage.sync`，每次请求带 header

**不做（Phase 2 不考虑）：**
- 插件内登录 / 账户系统
- 离线缓存解释结果

---

### 模块 C：GitHub Trending 周报邮件（Phase 3）

每周一定时爬取 GitHub Trending，AI 评审后发邮件到指定邮箱。

**功能细节：**
- 爬取 GitHub Trending 当周热门项目（Top 20）
- AI 对每个项目生成**大白话一句话摘要**，附 CTA：`有点意思，给我也整一个！→ [项目链接]`
- AI 按**技术创新性**和**场景创新性**综合打分，将项目归入五档：

  | 档位 | 含义 |
  |---|---|
  | 夯 | 顶尖，技术和场景都炸裂 |
  | 顶级 | 很强，值得深挖 |
  | 人上人 | 有亮点，普通人做不出来 |
  | NPC | 中规中矩，做了但没啥意思 |
  | 拉完了 | 乏善可陈 |

- 邮件按档位分组展示，全部五档都出现（空档位保留但标注"本周无"）
- 邮件标题风格：`速通本周 GH 热榜｜X 月 X 日在火什么玩意 | What the f is Hit in GitHub`（待细化）
- 支持按编程语言筛选（可配置）

**需求变更记录：**
- v1.1（2026-04-25）：原"1-2句摘要"升级为"摘要 + 五档排名 + 双维度打分"；新增 CTA 文案；确认拉完了档位也保留在邮件中；邮件标题风格初稿确认。

**外部订阅（Phase 4 已上线）：**
- 任意用户访问 `/subscribe` 留邮箱，免费订阅周报
- Cron 每周一群发所有 active 订阅者，每封邮件含退订链接
- 退订后 status 改为 cancelled，下次 cron 不再发送
- DB 预留 `stripe_customer_id` / `stripe_subscription_id` 字段，Phase 5 接付费

**GitHub 日报（Phase 5 规划中）：**

| | 日报（鸦闻日报） | 周报（夯拉排行榜）|
|---|---|---|
| 核心问题 | 今天发生了什么 | 这周什么值得深挖 |
| 阅读时间 | 2 分钟扫一眼 | 10 分钟细读 |
| 主角 | 昨日之星（涨幅最猛） | 经过评审的质量项目 |

日报邮件结构：昨日之星（含 AI 分析为什么火）→ 今日黑马 TOP 3 → 完整 ▲▼ 榜单

AI 分析数据来源：README + GitHub 最新 Release（有依据的推测，不是纯猜）

**可扩展（之后再加）：**
- 订阅频率偏好（日报/周报分开订阅）→ Phase 6
- Hacker News / Reddit / X 热点
- 付费订阅（Stripe）

---

## 三、笔记本功能详细需求

笔记本是贯穿三大模块的核心数据沉淀，需要重点设计。

**数据结构：**

| 字段 | 说明 |
|---|---|
| `id` | UUID |
| `user_id` | 真实 Supabase 用户 ID，由 RLS 强制隔离（Phase 5 ✅） |
| `client_note_id` | 客户端本地生成的幂等标识，用于游客笔记迁移去重（Phase 5 ✅） |
| `input_text` | 用户的问题/输入 |
| `explanation` | AI 解释内容 |
| `parent_id` | 追问时关联的父条目 |
| `parent_text` | 父条目的原始文本（展示上下文用） |
| `source` | 来源：`web` / `chrome_extension` |
| `saved_at` | 时间戳 |
| `tags` | 标签数组（预留，暂不做 UI） |

**Web 端笔记本页面：**
- 列表展示，默认折叠，点击展开
- 搜索（按 input_text 和 explanation 全文搜索）
- 删除
- 显示来源（Web / 插件，用小标签区分）

---

## 四、认证方案

### 历史方案（Phase 1-2，已废弃）

- 所有 API 请求带 `x-admin-secret: ADMIN_SECRET` header
- 后端校验 header，不匹配返回 401
- 所有笔记的 `user_id` 固定为常量 UUID（环境变量 `ADMIN_USER_ID`）

### 当前方案（Phase 5 ✅，2026-04-26 上线）

- **注册/登录**：`/register`、`/login` 页面，Supabase 邮箱 + 密码认证
- **鉴权**：前端持有 Supabase Session，所有笔记 API 请求带 `Authorization: Bearer <jwt>`
- **隔离**：后端用 `anon key + Bearer token` 创建用户态 Supabase 客户端，数据库层 RLS 强制执行行级隔离
- **游客模式**：未登录用户可正常使用，笔记临时存入 `localStorage`（key: `wtf_guest_notes_v1`）
- **迁移弹窗**：登录后检测到游客笔记，弹窗二次确认，一次性幂等迁移到当前账号
- **熔断开关**：`NOTEBOOK_MULTI_USER_ENABLED=false` 可快速回滚，API 返回 503

### Chrome 插件（Phase 2，维持原有 admin-secret 方案）

- 插件 Options 页面填写 `ADMIN_SECRET`，存入 `chrome.storage.sync`
- 每次请求带 `x-admin-secret` header
- Phase 5 后插件侧鉴权升级（接入 Supabase Bearer token）暂列 Phase 6 待办

---

## 五、非功能性需求

**成本控制：**
- Supabase 免费层：512MB DB，够用很久
- Vercel 免费层：足够自用流量 + Cron 每日1次
- Resend 免费层：3000 封/月，自用绰绰有余
- AI API：按实际 token 消耗，不产生闲置成本

**可扩展性（开发时注意预留）：**
- DB schema 保留 `user_id`，支持多用户
- API routes 的鉴权逻辑抽象为中间件，方便替换认证方案
- Chrome 插件与 Web 端共享 API 接口，不做专用接口

**历史数据：**
- localStorage 中的已有笔记不做迁移（已确认）
- Phase 1 上线后，笔记以云端为主

---

## 六、不在范围内（明确 out of scope）

- 移动端 App
- 社交功能（分享笔记等）
- 自定义 AI 模型（用户自己配置 key）
- 图片/截图 OCR 输入
- Chrome 插件侧 Supabase 登录（Phase 6 待办，现阶段维持 admin-secret）
