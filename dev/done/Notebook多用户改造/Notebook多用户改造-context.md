# Notebook 多用户改造 Context

## 当前状态
- 原有 `x-admin-secret + ADMIN_USER_ID` 方案只支持单管理员。
- `notes` 表已有 `user_id` 字段，适合升级到真实用户隔离。
- 前端此前无登录体系，`save` 通过 server action 直接落库。

## 本次决策
- Auth：Supabase 邮箱+密码
- 隔离：RLS + 用户 token 访问
- 游客迁移：登录后弹窗确认，一次性导入
- 风控：保留 `NOTEBOOK_MULTI_USER_ENABLED` 熔断开关

## 风险点
- 用户态 API 若未带 token，将被拒绝（401）
- Supabase 未配置匿名 key 时，浏览器登录不可用
- 未执行 SQL migration 时，游客迁移幂等可能失效

## 当前进度与下一步
- 当前进度：核心代码改造已完成，正在做命令级验证与验收用例验证。
- 下一步：
  1. 跑完未中断的 `lint/build`。
  2. 执行 SQL migration 并验证 RLS 生效。
  3. 按验收清单完成账号隔离与游客迁移测试。
