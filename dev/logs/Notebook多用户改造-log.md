# Notebook 多用户改造 日志

## 2026-04-26（Luna 开发）
- 新增会话态数据库客户端 `createUserDbClient(accessToken)`
- 改造 `/api/notes` 与 `/api/notes/[id]`：去除 admin-secret，改为 Bearer token + 用户身份校验
- 新增 `/api/notes/migrate-guest`，支持游客笔记登录后一次性迁移
- 新增浏览器 Supabase 客户端与会话 hook，补齐 `/login`、`/register` 页面
- `ExplanationCard` 增加游客保存逻辑；`Notebook` 增加游客视图与迁移确认弹窗
- 新增 SQL migration：`notes.client_note_id` + RLS policies + 幂等唯一索引
- 新增上线手册：`docs/notebook-multi-user-rollout.md`

## 2026-04-27（验收修复）
- 修复注册/登录按钮被环境变量检查静默禁用（无提示）
- 修正注册成功提示文案（改为邮件验证引导）
- 新增邮箱格式正则校验
- 登录错误提示改为中文，区分凭证错误与邮箱未验证
- merge main（Open Crow 改名），补全 login/register 页头文案及 localStorage key
- 修复游客笔记迁移：upsert 偏函数索引兼容问题，改为先查再插
- 全部 TC 用户验收通过（TC-01 ～ TC-09，RT-01 ～ RT-03）

## 遗留问题（不阻塞上线）
- TC-05：跨账号删除返回 200 而非 404，安全无隐患，后续迭代优化
