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
- [x] 步骤：未登录请求 `GET /api/notes`、`POST /api/notes`、`POST /api/notes/migrate-guest`
- [x] 预期：全部返回 `401 Unauthorized`
- [x] 结果：**PASS（代码审查）** — 三个端点均先调用 `getAccessTokenFromRequest` + `getRequestUser`，token 缺失或无效时返回 `unauthorizedResponse()`（HTTP 401）

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
- [x] 步骤：B 尝试删除 A 的 note id
- [x] 预期：A 的笔记仍存在（删除不应生效）
- [x] 结果：**PASS（代码审查）** — `deleteNote` 使用用户态 DB 客户端（`createUserDbClient(token)`），RLS 策略 `using (auth.uid() = user_id)` 在数据库层阻止跨用户删除，A 的笔记不受影响。⚠️ 注意：API 不检查实际删除行数，B 的请求会收到 200 但笔记未被删除，属轻微误导（安全无隐患，后续可优化返回 404）

### TC-06 游客迁移（确认弹窗）
- [ ] 步骤：未登录保存 2 条游客笔记 -> 登录 A -> 弹窗确认迁移
- [ ] 预期：游客笔记迁入 A 账号，迁移后游客缓存清空
- [ ] 结果：PASS / FAIL（备注）

### TC-07 迁移幂等
- [x] 步骤：对同一组 `clientNoteId` 重复触发迁移
- [x] 预期：不重复插入
- [x] 结果：**PASS（代码审查）** — `migrateGuestNotes` 使用 `.upsert(rows, { onConflict: 'user_id,client_note_id' })`，配合 SQL migration 中 `notes_user_client_note_unique_idx` 唯一索引，重复迁移只更新不新增

### TC-08 搜索与删除
- [ ] 步骤：在 `/notebook` 搜索并删除一条当前账号笔记
- [ ] 预期：搜索结果正确，删除后刷新仍不存在
- [ ] 结果：PASS / FAIL（备注）

### TC-09 熔断开关
- [x] 步骤：设置 `NOTEBOOK_MULTI_USER_ENABLED=false` 并请求 notes API
- [x] 预期：返回 `503`
- [x] 结果：**PASS（代码审查）** — `isNotebookMultiUserEnabled()` 在 `NOTEBOOK_MULTI_USER_ENABLED === 'false'` 时返回 false，三个端点均在入口处检查并返回 503

## 4. 回归测试（受影响模块）

### RT-01 解释主链路
- [x] 步骤：首页输入术语，触发流式解释
- [x] 预期：解释正常返回，页面无异常
- [x] 结果：**低风险（代码审查）** — `/api/explain` 未被本次改动涉及，`app/page.tsx` 仅新增 `AuthNav` 和 `GuestMigrationModal` 挂载，主链路逻辑无改动，build 通过

### RT-02 订阅链路
- [x] 步骤：访问 `/subscribe` 提交邮箱
- [x] 预期：订阅接口行为正常
- [x] 结果：**低风险（代码审查）** — 订阅相关文件未被本次改动触及

### RT-03 周报链路
- [x] 步骤：手动触发周报 cron 路由（测试环境）
- [x] 预期：周报逻辑不受本次改动影响
- [x] 结果：**低风险（代码审查）** — `weekly-digest/route.ts` 仅修复了一处未使用参数（`parseReviewedRepos` 移除 `source` 参数），核心逻辑无改动

## 5. 测试结论

- 当前结论：`PARTIAL PASS` — 代码审查用例全部通过，剩余 5 项待用户在真实环境手动验收
- lint/build：**PASS**（1 个预存 warning 在 Chrome 插件，非本次改动）
- 代码审查 PASS 用例：TC-01 ✅ TC-05 ✅ TC-07 ✅ TC-09 ✅ RT-01/02/03 ✅（低风险）
- 待用户手动验收（需先执行 SQL migration）：
  - [ ] **前置：执行 `db/migrations/20260426_notebook_multi_user.sql`**
  - [ ] TC-02 登录注册闭环（浏览器）
  - [ ] TC-03 登录后保存笔记可见（浏览器）
  - [ ] TC-04 A/B 账号隔离互不可见（浏览器，2个账号）
  - [ ] TC-06 游客笔记迁移弹窗完整流程（浏览器）
  - [ ] TC-08 搜索与删除功能（浏览器）
- 遗留问题：
  - [ ] 轻微：TC-05 跨账号删除返回 200 而非 404，安全无隐患，后续迭代可优化
