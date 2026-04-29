# Chrome 扩展插件内 Refresh — Tasks

> 更新：进行中请改状态，避免多人重复开工。  
> **当前分支**：`fea/chrome-ext-session-refresh-tri`（立项文档 + 分支规则说明；向 `dev` 提 PR 合并）

## 开发准备

- [x] 从最新 `dev` 切分支：`fea/chrome-ext-session-refresh-tri`
- [x] 在本文件顶部 **回填实际分支名**

## Web

- [x] `useAuthSession`（或等价）暴露 `refresh_token`、`expires_at`（若刷新策略需要）
- [x] `AuthNav`：`CROW_CONNECT_EXT` 增加 `refreshToken`、`supabaseUrl`、`supabaseAnonKey`（来源：既有 `NEXT_PUBLIC_*`）
- [x] 确认无 console 泄露完整 token

## 扩展 — 存储与桥接

- [x] `content/index.tsx`（或统一 bridge）：接收扩展 payload，写入 **`chrome.storage.local`**（至少 `refreshToken`；建议与 `accessToken`、`supabaseUrl`、`supabaseAnonKey`、`apiBaseUrl` 同区域）
- [x] 明确是否保留 `sync` 仅作遗留键清理或统一迁移到 `local`（与 plan 二选一，实现后更新 `Options` / `popup` 读取路径）
- [x] 连接成功仍 `postMessage` `CROW_CONNECT_EXT_OK`；失败路径不误报 OK

## 扩展 — Refresh 逻辑

- [x] 添加 `@supabase/supabase-js` 依赖（版本与主站协调）
- [x] 实现 `refreshSession` 封装（含错误分类：网络 vs 401/invalid_grant）
- [x] 在 **API 请求前** 和/或 **401 后重试前** 挂接刷新；避免死循环（最多 1 次 refresh + 重试）
- [x] 刷新成功后更新 `local` 内 `accessToken`（及 Supabase 返回的新 `refresh_token` 若有轮换）
- [ ] （可选 P1）background 集中调度，降低多 tab 并发 refresh

## 扩展 — UI 与降级

- [x] `ExplainCard` / 统一 fetch：接入新 token；refresh 失败后沿用或微调「回网站重新连接」
- [x] `Options` / `popup`：展示连接状态逻辑兼容仅 local 存储

## 文档

- [x] `docs/product/chrome-extension.md` 或 `auth.md`：一句说明「连接时同步 refresh，散发使用可减少重连」
- [x] `docs/tech/environments-and-deployment.md`：多环境连接、换 Preview 需重连（若尚未写清）

## QA / 发布

- [ ] 本地 + Staging：过期 JWT 场景、退出登录场景、旧存储无 refresh 场景
- [ ] 合并前 `npm run lint` / `verify` 通过
- [ ] 合并后创建 `Chrome扩展插件内refresh-qa.md`（由 QA 按流程补）

## 完成收尾（阶段 5）

- [ ] PM 审核 tasks 全勾
- [ ] 迁移至 `dev/done/Chrome扩展插件内refresh/` 等流程项（按 `dev-workflow.mdc`）
