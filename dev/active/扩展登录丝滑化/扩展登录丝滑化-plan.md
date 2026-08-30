# 扩展登录丝滑化 — Plan

> **用户批准立项**：2026-08-30（对话确认「卡片+过期恢复+Popup」全范围 + 顺手清理调试埋点）
> **分支**：`fea/ext-inline-login-wesrindo`（从最新 `fea/future-features` 切出）

## 背景与问题

用户反馈插件登录「不丝滑」。代码走查确认三个卡点：

1. **动线深**：划词卡片点「登录后可保存」→ 跳扩展设置页 → 输邮箱密码 → 切回网页 → 重新划词 → 重新等流式解释 → 再点保存，共 6+ 步且重复等待一次 AI 解释。
2. **过期恢复同样深**：保存遇 401 且 refresh 失败，只提示「去扩展设置重新登录」，无就近恢复手段。
3. **Popup 不能登录**，只能再跳设置页。

## 目标

1. 划词卡片**内嵌登录**：未登录点「登录后可保存」→ 卡片内展开邮箱/密码表单，登录成功**自动继续保存**。
2. 过期**就近恢复**：卡片内点「重新登录」→ 登录成功自动重试（含重复笔记「覆盖旧的」场景不丢上下文）。
3. **Popup 内登录**：未登录时 popup 直接渲染登录表单，成功即显示已登录。
4. 顺手清理调试埋点（`fabDebug` / `debug-fab-log.ts` / background 的 `127.0.0.1:7254` 上报）。

## 方案要点

- 新增 `lib/crow-inline-login.ts`：`loginAndPersist()` 与 refresh 相同双通道策略（优先 background SW 发 GoTrue password grant，失败当前上下文直连兜底），成功 `persistCrowAuth`。
- background 新增 `CROW_PASSWORD_LOGIN` 消息通道（与 `CROW_EXCHANGE_REFRESH` 同模式）。
- 新增共享组件 `components/CrowLoginForm.tsx`（card / popup 两种 variant）。
- `ExplainCard` 记录打断点：登录成功后按 `duplicate` 有无自动续走 `handleSave` / `handleReplace`。
- manifest 0.1.25 → 0.1.26。

## 明确不做

- 网站「连接插件」流程与后端 API 不动（纯扩展端改造）。
- 扩展内注册 / Magic link 仍不做（沿用 C-3 方案 A 决策）。
- 双份 normalize 等既有债务不动。

## 验收

- 自动化：根 `lint` + `vitest`（含新增 `crow-inline-login.test.ts`）+ 扩展 `build` + `test:e2e`（extension-crow-bridge 5 条）全绿。
- 手测：[`扩展登录丝滑化-manual-test.md`](./扩展登录丝滑化-manual-test.md) 三条新路径（卡片内登录续存、过期内联重登、Popup 登录）。
