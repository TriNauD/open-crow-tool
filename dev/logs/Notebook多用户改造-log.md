# Notebook 多用户改造日志

## 2026-04-26
- 修正流程执行偏差：补充 `dev/active/Notebook多用户改造/` 任务与上下文的实时状态，新增“待验证任务”与“下一步”。
- 新增会话态数据库客户端 `createUserDbClient(accessToken)`，用于用户 token 访问。
- 改造 `/api/notes` 与 `/api/notes/[id]`：去除 admin-secret 依赖，改为 Bearer token + 用户身份校验。
- 新增 `/api/notes/migrate-guest`，支持游客笔记登录后一次性迁移（幂等 upsert）。
- 新增浏览器 Supabase 客户端与会话 hook，补齐 `/login`、`/register` 页面。
- `ExplanationCard` 增加游客保存逻辑；`Notebook` 增加游客视图与迁移确认弹窗。
- 新增 SQL migration：`notes.client_note_id` + `RLS policies` + 幂等唯一索引。
- 新增上线手册：`docs/notebook-multi-user-rollout.md`，包含监控、阈值、回滚。
- 完成本地验证：`npm run lint` 通过（仅残留既有 warning），`npm run build` 通过。
