# 认证方案

> 原 PRD「四、认证方案」

### 历史方案（Phase 1-2，已废弃）

- 所有 API 请求带 `x-admin-secret: ADMIN_SECRET` header
- 后端校验 header，不匹配返回 401
- 所有笔记的 `user_id` 固定为常量 UUID（环境变量 `ADMIN_USER_ID`）

### 当前方案（Phase 5 ✅，2026-04-26 上线）

- **注册/登录**：`/register`、`/login` 页面，Supabase 邮箱 + 密码认证
- **鉴权**：前端持有 Supabase Session，所有笔记 API 请求带 `Authorization: Bearer <jwt>`
- **隔离**：后端用 `anon key + Bearer token` 创建用户态 Supabase 客户端，数据库层 RLS 强制执行行级隔离
- **游客模式**：未登录用户可正常使用，笔记临时存入 `localStorage`（key: `crow_guest_notes_v1`）
- **迁移弹窗**：登录后检测到游客笔记，弹窗二次确认，一次性幂等迁移到当前账号
- **熔断开关**：`NOTEBOOK_MULTI_USER_ENABLED=false` 可快速回滚，API 返回 503

### Chrome 插件（与 Web 多用户方案一致，2026-04-27 ✅；C-3 扩展内登录）

- **扩展 Options 主路径**：邮箱 + 密码登录（同一 Supabase 项目），成功后 `persistCrowAuth`（含 refresh）
- **网站「连接插件」**：写入同一套 `CrowAuth`；与扩展内登录后写覆盖
- Options「高级」折叠区可手动填 API / 令牌（自托管）
- 存笔记等需用户隔离的请求带 `Authorization: Bearer <jwt>`
- 历史 `ADMIN_SECRET` / `x-admin-secret` 与扩展侧 `adminSecret` 键在成功连接或保存新配置时清理，避免误用
- 插件内 session refresh 见 `dev/active/Chrome扩展插件内refresh/`；产品概述见 `docs/product/chrome-extension.md`
