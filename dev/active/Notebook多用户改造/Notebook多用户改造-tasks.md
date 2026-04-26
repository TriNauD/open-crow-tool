# Notebook 多用户改造 Tasks

## 开发任务
- [x] 鉴权改造：notes API 改为用户会话 + Bearer token
- [x] RLS 落地：新增 migration SQL，配置 notes 行级策略
- [x] 游客迁移：新增登录后二次确认迁移弹窗 + 迁移 API
- [x] 登录闭环：新增 `/login`、`/register` 与导航登录态
- [x] 上线风控：新增开关 `NOTEBOOK_MULTI_USER_ENABLED` 与回滚手册

## 待验证任务（验收前必须完成）
- [ ] 执行 `db/migrations/20260426_notebook_multi_user.sql` 并确认生效
- [x] 本地完整跑通 `npm run lint` 与 `npm run build`（命令未被中断）
- [ ] 按账号隔离用例验证：A/B 账号互不可见
- [ ] 游客迁移用例验证：登录后二次确认迁移成功，迁移后游客数据清空
