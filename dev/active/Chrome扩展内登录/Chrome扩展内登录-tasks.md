# Chrome 扩展内登录 — Tasks

> 基线：`fea/future-features` → 功能分支 `fea/chrome-ext-inapp-login-wesrindo`  
> 结项前：QA 文档、迁移 `dev/done/`、补 `dev/logs/`（见 `dev-workflow.mdc`；本批先合 future）

## 阶段 0：定稿

- [x] TL：**选定扩展内登录主方案** — **方案 A**（Options 内邮箱密码 + GoTrue `grant_type=password` 纯 fetch；**不加** `@supabase/supabase-js` / **不申请** `identity`）
- [x] TL：确认 **apiBaseUrl / Supabase 环境** — 构建注入 `VITE_PUBLIC_SITE_ORIGIN` + `VITE_PUBLIC_SUPABASE_*`（与网站对齐）；见 `.env.example`
- [x] PM：定稿 **主界面文案** — 登录 / 已登录 / 退出登录；高级区「高级选项（自托管 / 开发者）」；失败态中文可读

## 阶段 1：实现

- [x] Options：**主路径** — 邮箱密码登录，成功后 `persistCrowAuth`（字段与网站桥接一致）
- [x] Options：**退出登录** — `clearCrowAuth` 清理 `CROW_AUTH_LOCAL_KEYS` 及遗留 sync
- [x] Options：**布局** — 手动填写默认折叠；文案去技术化
- [x] 扩展：**错误与加载态** — 凭据错误、未验证邮箱、429、网络失败
- [x] （方案 B）Web OAuth / identity — **本期不做**
- [x] `manifest.json`：版本 `0.1.25`（本方案无需 `identity` 权限）
- [x] 文档：`docs/product/chrome-extension.md`、`docs/product/auth.md`；手测 `Chrome扩展内登录-manual-test.md`

## 阶段 2：验证

- [ ] 手测：仅扩展登录 → 划词 → 存笔记 → 刷新会话后仍可用（见 manual-test §A）
- [ ] 手测：仅网站连接 → 仍可用（回归，manual-test §C）
- [ ] 手测：两种入口先后使用，确认「后写覆盖」（manual-test §D）
- [x] `npm run lint` + 相关单测 + 扩展 build（合入 future 前跑通）

## 阶段 3：QA / 收尾

- [ ] 新建并填写 `Chrome扩展内登录-qa.md`（合 `dev` / 结项时）
- [ ] PM 审核 tasks 全勾 + 用户验收后再 commit / PR（见 `dev-workflow.mdc` 阶段 5）
