# Notebook 多用户上线与回滚手册

## 发布前检查
- [ ] Supabase 已执行 `db/migrations/20260426_notebook_multi_user.sql`
- [ ] `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` 已配置
- [ ] `NOTEBOOK_MULTI_USER_ENABLED=true`
- [ ] 至少 1 个测试账号可登录并完成笔记增删改查

## 监控项（最小集合）
- `auth_failed`：鉴权失败次数（401）
- `request_failed`：`/api/notes*` 的 5xx 次数
- `guest_migration_failed`：游客迁移失败次数
- `guest_migration_success`：游客迁移成功次数

## 事故阈值
- 5 分钟内 `auth_failed` 突增到平时 3 倍以上
- 5 分钟内 `request_failed` >= 10 次
- 连续出现 `guest_migration_failed` >= 3 次

满足任一阈值即触发回滚。

## 回滚步骤
1. 立即将 `NOTEBOOK_MULTI_USER_ENABLED` 设置为 `false`
2. 重新部署，确认 `/api/notes` 返回 503（熔断生效）
3. 在日志中定位异常请求与触发用户
4. 修复后再将开关设回 `true` 并灰度验证

## 发布后验收
- 不同账号互相看不到对方笔记
- 游客笔记可通过二次确认迁移到当前账号
- 关闭开关后 API 快速拒绝写入，恢复开关后可继续使用
