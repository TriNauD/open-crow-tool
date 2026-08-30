# 扩展登录丝滑化 — 任务清单

> 自动化门禁已于 2026-08-30 全绿（lint / vitest 41+41 / 扩展 build / e2e 5 条）。

## 编码

- [x] `lib/crow-inline-login.ts`：`buildCrowAuthFromLogin` + `loginAndPersist`（SW 优先直连兜底）
- [x] `background/index.ts`：`CROW_PASSWORD_LOGIN` 通道（复用 `performSupabasePasswordLogin`）
- [x] `components/CrowLoginForm.tsx`：共享内嵌登录表单（card / popup）
- [x] `content/ExplainCard.tsx`：未登录「登录后可保存」→ 卡片内展开表单；登录成功自动续存
- [x] `content/ExplainCard.tsx`：`expired` → 「重新登录」内联入口；登录后按 duplicate 续走 handleSave/handleReplace
- [x] `popup/main.tsx`：未登录时 Popup 内嵌登录表单
- [x] 清理调试埋点：删 `debug-fab-log.ts`、App.tsx 全部 `fabDebug`、background `CROW_DEBUG_FAB` 上报
- [x] Options 文案：下方登录 → 上方登录；登录成功提示补「回到网页重新划词即可保存」
- [x] manifest 0.1.25 → 0.1.26

## 测试与门禁

- [x] `__tests__/crow-inline-login.test.ts`（auth 组装与规范化；抓出 supabaseUrl 尾斜杠 bug 并修复）
- [x] `npm run lint` 全绿
- [x] `vitest` 41/41 全绿（Node 20）
- [x] 扩展 `vite build` 成功
- [x] `e2e/extension-crow-bridge.spec.ts` 5/5 全绿

## 文档

- [x] 立项三件套（plan / context / tasks）
- [x] `扩展登录丝滑化-manual-test.md`
- [x] `Chrome扩展内登录-manual-test.md` 补交叉引用
- [ ] 合入 future 后更新 `future-features-integration.md` 进度表与 handoff §3（随 merge commit）

## 用户手测（结项前必做）

- [ ] A 卡片内登录 → 自动续存（manual-test §A）
- [ ] B 保存遇过期 → 内联重登 → 自动重试（manual-test §B）
- [ ] C Popup 内登录（manual-test §C）
- [ ] qa.md 补充与结项迁 `dev/done/`
