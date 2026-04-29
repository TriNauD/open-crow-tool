# Chrome 扩展插件内 Refresh — Context

> 立项日期：2026-04-28  
> 状态：**已立项，待开发分支切出后更新分支名**

## 背景

- 扩展当前仅通过「连接插件」写入 **access_token（JWT）**，不参与 Supabase 的自动续期。
- Supabase access token 默认约 **1 小时**；用户 **散发、时不时** 打开扩展时，常见路径是：数日未连接 → 划词/存笔记 → **401**，需回网站再点一次连接。
- Web 端已配置 `autoRefreshToken`，会话可长期保持；**扩展与 Web 的凭证生命周期脱节** 是体验主因。

## 用户价值

- 在 **refresh_token 仍有效** 的前提下，扩展可在调用 API 前 **静默换新 access_token**，减少「突然想起用一下却失效」的摩擦。
- 与 PM/TL 已达成共识：**中长期正确解** 为插件内 refresh，而非无限拉长 JWT。

## 约束与原则

- **refresh_token** 敏感：优先 **`chrome.storage.local`**，避免写入 `sync` 扩散到多设备（若与 `apiBaseUrl` 分列存储，文档中写清）。
- **anon key、Supabase URL** 为公开配置：可由页面经 postMessage 下发，使 **同一扩展包** 适配 Preview / 生产（无需为每环境单独打包）。
- **失败降级**：refresh 失败或 token 作废时，沿用现有文案：**回网站重新「连接插件」**（必要时登录）。
- **合规**：不在控制台、postMessage 日志中打印 refresh_token。

## 相关文档 / 前序需求

- `docs/product/auth.md`、`docs/product/chrome-extension.md`
- `dev/done/Chrome扩展多用户鉴权/`（当前连接与 401 引导基线）

## 关键决策（立项确认）

- 本期 **做插件内 refresh**（使用 Supabase GoTrue 标准 refresh 流程，在扩展内发起）。
- 不在本期做：扩展内完整登录（PKCE / `chrome.identity`）、仅服务端中转 refresh（除非实现中发现 CORS/权限硬阻塞再评估）。
