# 扩展登录丝滑化 — Context

## 背景

- C-3（`fea/chrome-ext-inapp-login-wesrindo`）已落地扩展内登录主路径：Options 内邮箱密码 → GoTrue password grant → `persistCrowAuth`。但登录**入口**仍分散在 Options 与网站「连接插件」，划词卡片与 Popup 只做「引导跳转」。
- 用户实际使用反馈：插件登录「不丝滑」。本需求在 C-3 之上收敛动线，不推翻现有存储模型与 API 契约。

## 代码走查结论（2026-08-30）

| 结论 | 位置 |
|------|------|
| 卡片「登录后可保存」此前直接 `onConnectPlugin()`（`chrome.runtime.openOptionsPage`），登录后无任何回到卡片的路径 | `content/ExplainCard.tsx` |
| 保存 401/403 → `ensureFreshAuth(force)` 一次；refresh 失败即 `saveError='expired'`，提示去设置页 | `content/ExplainCard.tsx` `saveWithToken` |
| refresh 已有「SW 优先、直连兜底」双通道先例（`CROW_EXCHANGE_REFRESH`），登录照搬同一模式即可避开第三方页面 CSP/Origin 差异 | `lib/crow-session.ts` + `background/index.ts` |
| `crowAuthUpdatedAt` 时间戳使每次 `persistCrowAuth` 都触发 `storage.onChanged`，App/Options/popup 自动刷新——内嵌登录无需额外广播 | `lib/crow-session.ts` |
| 调试埋点 `fabDebug` 分布于 App.tsx（H1–H7）+ `debug-fab-log.ts` + background 的 `CROW_DEBUG_FAB`（上报 `127.0.0.1:7254`），打包产物仍携带，属调试遗留 | `content/App.tsx` 等 |
| manifest `host_permissions: <all_urls>`，SW 直连 Supabase 无权限障碍 | `manifest.json` |

## 关键决策

| 决策 | 内容 |
|------|------|
| 双通道登录 | 与 refresh 一致：background SW 优先（`CROW_PASSWORD_LOGIN`），SW 不可用再本上下文直连；错误文案复用 `mapPasswordLoginError`。 |
| 自动续存 | `handleLoginSuccess` 按 `duplicate` 有无续走 `handleSave` / `handleReplace`；重复确认上下文（旧/新答案对比）不丢。 |
| 表单复用 | `components/CrowLoginForm.tsx` 单组件 card/popup 两 variant；Options 主路径保持独立（布局不同，不强拆）。 |
| 过期文案 | 「重新登录」为卡片内按钮（内联表单），「回网站连接插件」降级为次选链接。 |
| 调试埋点 | 全量移除（用户确认），不保留开关。 |
| 版本 | manifest 0.1.25 → 0.1.26。 |

## 已知取舍

- 卡片定位仍用固定高度估算（`cardH=320`），登录表单展开后卡片实际高度增加，锚点偏移可接受（表单在 body 顶部向下展开，不遮选区）。
- Popup 宽度 240px，登录表单为紧凑版（字号/内距略小）。
- 未登录时 `effectiveConfig` 使用公开 fallback URL 解释（原有行为不变）；登录后 `storage.onChanged` 触发 `reloadAuth`，卡片 footer 切换为「存入笔记本」。
