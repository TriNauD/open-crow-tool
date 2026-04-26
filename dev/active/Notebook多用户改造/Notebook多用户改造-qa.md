# Notebook 多用户改造 QA

## 1. 影响域标注

- 需求名称：Notebook 多用户改造
- 测试阶段：QA 验收
- 风险等级：High

### 涉及模块
- 鉴权与会话：`hooks/useAuthSession.ts`、`lib/supabase/browser.ts`
- 笔记 API：`app/api/notes/route.ts`、`app/api/notes/[id]/route.ts`、`app/api/notes/migrate-guest/route.ts`
- 数据层与策略：`lib/db/notes.ts`、`db/migrations/20260426_notebook_multi_user.sql`
- 页面与交互：`app/page.tsx`、`app/notebook/page.tsx`、`components/GuestMigrationModal.tsx`

## 2. 测试前置条件

- [ ] 已执行 SQL：`db/migrations/20260426_notebook_multi_user.sql`
- [ ] `.env.local` 已配置：
  - `SUPABASE_ANON_KEY`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] 启动服务：`npm run dev`
- [ ] 准备两个测试账号：A、B

## 3. 功能测试（新功能）

### TC-01 未登录鉴权
- [ ] 步骤：未登录请求 `GET /api/notes`、`POST /api/notes`、`POST /api/notes/migrate-guest`
- [ ] 预期：全部返回 `401 Unauthorized`
- [ ] 结果：PASS / FAIL（备注）

### TC-02 登录与注册闭环
- [ ] 步骤：访问 `/register` 注册 -> `/login` 登录 -> 进入 `/notebook`
- [ ] 预期：页面可用，无 runtime error，登录成功
- [ ] 结果：PASS / FAIL（备注）

### TC-03 A 账号保存笔记
- [ ] 步骤：A 登录后保存一条唯一笔记（例如 `A-only-<timestamp>`）
- [ ] 预期：`/notebook` 列表可见该笔记
- [ ] 结果：PASS / FAIL（备注）

### TC-04 账号隔离
- [ ] 步骤：A 保存后退出，B 登录并搜索 A 的唯一关键字
- [ ] 预期：B 看不到 A 的笔记
- [ ] 结果：PASS / FAIL（备注）

### TC-05 跨账号删除保护
- [ ] 步骤：B 尝试删除 A 的 note id
- [ ] 预期：A 的笔记仍存在（删除不应生效）
- [ ] 结果：PASS / FAIL（备注）

### TC-06 游客迁移（确认弹窗）
- [ ] 步骤：未登录保存 2 条游客笔记 -> 登录 A -> 弹窗确认迁移
- [ ] 预期：游客笔记迁入 A 账号，迁移后游客缓存清空
- [ ] 结果：PASS / FAIL（备注）

### TC-07 迁移幂等
- [ ] 步骤：对同一组 `clientNoteId` 重复触发迁移
- [ ] 预期：不重复插入
- [ ] 结果：PASS / FAIL（备注）

### TC-08 搜索与删除
- [ ] 步骤：在 `/notebook` 搜索并删除一条当前账号笔记
- [ ] 预期：搜索结果正确，删除后刷新仍不存在
- [ ] 结果：PASS / FAIL（备注）

### TC-09 熔断开关
- [ ] 步骤：设置 `NOTEBOOK_MULTI_USER_ENABLED=false` 并请求 notes API
- [ ] 预期：返回 `503`
- [ ] 结果：PASS / FAIL（备注）

## 4. 回归测试（受影响模块）

### RT-01 解释主链路
- [ ] 步骤：首页输入术语，触发流式解释
- [ ] 预期：解释正常返回，页面无异常
- [ ] 结果：PASS / FAIL（备注）

### RT-02 订阅链路
- [ ] 步骤：访问 `/subscribe` 提交邮箱
- [ ] 预期：订阅接口行为正常
- [ ] 结果：PASS / FAIL（备注）

### RT-03 周报链路
- [ ] 步骤：手动触发周报 cron 路由（测试环境）
- [ ] 预期：周报逻辑不受本次改动影响
- [ ] 结果：PASS / FAIL（备注）

## 5. 测试结论

- 当前结论：`PENDING`
- 核心用例（TC-04/TC-05/TC-06/TC-09）是否全部通过：`待执行`
- 遗留问题：
  - [ ] 无
  - [ ] 有（请列出 issue 链接 / 复现步骤 / 影响范围）
