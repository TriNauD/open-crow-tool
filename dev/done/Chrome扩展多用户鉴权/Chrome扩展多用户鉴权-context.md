# Chrome 扩展多用户鉴权 — Context

## 背景

站点已完成 Notebook 多用户改造：`/api/notes` 以 **Supabase 登录会话** 鉴权（`Authorization: Bearer` + 服务端 `getUser`），不再使用 `x-admin-secret`。Chrome 扩展此前仍用 Admin Secret，与后端能力不一致，本需求将其对齐。

- 分支：`fea/chrome-ext-user-auth-tri`（从 `dev` 切出）
- 依赖：`dev/done/Notebook多用户改造` 已上线或在 Preview 可测

---

## 关键决策

### 「访问令牌」对用户不可见

- 技术上是 Supabase 会话签发的 **access_token**（JWT），约 1 小时有效，由 `getUser(token)` 在服务端换用户身份。
- 对用户**完全不暴露**这个词；界面统一用「连接插件 / 已连接 / 重新连接」表达。

### 通信方式：window.postMessage

- content script 已在所有页面（含 Crow 站点）运行，天然可作桥梁。
- 用 `event.origin` + `event.source` 双重校验，拒绝第三方页面触发。
- 不引入 `externally_connectable`，不暴露 extension ID，不需要中转服务。

### 直接传 access_token，不做短命 code 中转

- access_token 已是短命凭证，与网站 localStorage 里的安全等级一致。
- 中转 code 方案工程量 3 倍，安全收益接近零，不采用。

### 令牌过期处理

- 401 响应 → 精确文案 + 直接跳回网站重新连接，不静默失败。
- 静默探测「即将过期」列为后续增量，本期不做。

---

## 约束

- 后端已锁定：存笔记**必须**带合法 Bearer，扩展不单独开管理员代存口。
- 扩展内不做完整登录流（Supabase PKCE / chrome.identity），作为 C 档记录在 roadmap。
- token 存于 `chrome.storage.sync`，与隐私说明一致（见 `env-and-secrets.mdc`）。
- 游客模式：扩展内**不做**游客本机暂存，仅支持「已登录用户云端存笔记」。
