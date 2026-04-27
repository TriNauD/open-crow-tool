# Notebook 多用户改造 Plan

## 目标
- 将笔记存储从 `ADMIN_USER_ID` 固定归属切换到真实用户会话。
- 支持游客暂存与登录后一次性迁移。
- 使用 RLS 作为数据库主防线，避免跨用户数据读取。

## 变更范围
- API：`/api/notes`、`/api/notes/[id]`、`/api/notes/migrate-guest`
- 前端：登录/注册页面、首页/笔记页会话与迁移弹窗
- 数据库：`notes` 表增加 `client_note_id`，启用 RLS policy
- 运维：增加多用户开关与回滚手册
