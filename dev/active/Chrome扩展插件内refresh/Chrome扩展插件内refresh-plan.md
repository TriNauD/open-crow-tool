# Chrome 扩展插件内 Refresh — Plan

> 立项日期：2026-04-28

## [PM] 功能描述与验收

### 要解决什么

- **散发使用**：用户几天未专门「维护插件」，只要 **Web 账号会话在 Supabase 侧仍可 refresh**，扩展应 **尽量自动恢复可用**，而不是一到期就只依赖「回站再点连接」。

### 用户可见行为

- **成功路径**：无新按钮；划词解释、存笔记在 token 过期后 **首次请求前或遇 401 后** 自动刷新，用户无感知。
- **失败路径**：refresh 不可用（例如用户已在全站退出、refresh 过期）→ **明确引导** 回网站登录并再次「连接插件」（沿用现有 401  copy 体系，必要时微调文案为「登录或连接已过期」）。

### 验收标准（建议）

1. 用户 **已登录网站** 并点击「连接插件」后，**本地仅延长间隔、不主动再点连接**：在 Supabase refresh 窗口内，扩展调用 `POST /api/notes` 或 explain 相关请求 **不应因 access JWT 过期 alone 而持续失败**（自动 refresh 后重试成功）。
2. **全站退出 / refresh 撤销** 后：扩展请求失败，且提示 **可理解、可操作**（回站登录 + 连接）。
3. **安全**：refresh_token 仅存 `chrome.storage.local`（或明确等价策略）；文档与代码审查中可指认存储键与清理点（连接覆盖、退出逻辑若存在则清空）。

### 本期不做

- 扩展内嵌注册/登录 UI。
- 将 refresh_token 上传到自建服务端做「二次托管」。

---

## [TL] 技术方案概要

### 1. Web → 扩展：payload 扩展

- 文件：`components/AuthNav.tsx`（及必要时 `hooks/useAuthSession.ts`）。
- `window.postMessage` 在 `CROW_CONNECT_EXT` 中除现有 `accessToken`、`apiBaseUrl` 外，增加：
  - `refreshToken`（来自当前 `session.refresh_token`）
  - `supabaseUrl`（`NEXT_PUBLIC_SUPABASE_URL`）
  - `supabaseAnonKey`（`NEXT_PUBLIC_SUPABASE_ANON_KEY`）
- 校验逻辑保持不变：`samePageOrigin(apiBaseUrl, e.origin)` 等；**不在日志中打印上述 Secret 类字段**。

### 2. 扩展存储

- **`chrome.storage.sync`**：可继续仅存 **非敏感、且希望跟随 Google 账号的配置**（若团队希望简化，也可全部改为 `local` —— tasks 里二选一，默认 **refresh + anon + url 一律 local**，`apiBaseUrl` 是否跟 local 走以一致为准）。
- **`chrome.storage.local`**：`refreshToken`、`accessToken`、`supabaseUrl`、`supabaseAnonKey`（或与 sync 拆分策略见 tasks）。

### 3. Refresh 实现路径（推荐）

- 在扩展内使用 **`@supabase/supabase-js`**（与站点对齐版本范围），`createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } })`，调用 `setSession({ access_token, refresh_token })` 后 `refreshSession()`，或用 **GoTrue REST** `POST /auth/v1/token?grant_type=refresh_token`（等价，择一实现，优先复用官方 client 减少自己拼请求）。
- **调用时机**：
  - **防御性**：在发起到本站 API 的 Bearer 请求前，若已知 `expires_at` 已过期或临近过期（若 payload 带 `expiresAt`），先 refresh；或
  - **响应式**：401 时尝试一次 refresh + 重试（需避免无限循环）。
- **执行位置**：优先 **background service worker** 集中刷新 + 写回 storage，content 通过 `chrome.runtime.sendMessage` 取最新 token；若工期紧，首期可在 **content 内** 刷新并写 storage（注意 duplicate tab 并发，可用简单锁或「仅 background 写」随后再收敛）。

### 4. 依赖与权限

- `manifest.json`：已有 `storage`；若仅向 Supabase HTTPS 发请求，通常 **不需** 新增 `host_permissions`（`fetch` 从 extension origin 发起）。若采用 `identity` 等再议。
- `chrome-extension/package.json`：新增 `@supabase/supabase-js` 及类型（与主站大版本相容）。

### 5. 兼容与迁移

- 仅存有旧版 `accessToken` / `apiBaseUrl`、**无** `refreshToken` 的存储：**行为与今相同**，401 后提示回站「连接插件」一次即可写入新字段。

### 6. 风险

- **并发**：多 tab 同时 401 触发多次 refresh，通常 GoTruth 会使旧 refresh 失效；应用「单飞」刷新或 background 队列降低风暴。
- **误配环境**：用户连接 Preview 后又切生产需再点连接（与今一致）；文档可在 `docs/tech/environments-and-deployment.md` 补一句。

---

## [QA] 测什么（摘要）

- 连接后 **等待 access JWT 过期**（或可临时改短 JWT 仅 Staging 测），不点「连接插件」，直接划词 / 存笔记 → 应成功或至多一次短暂重试成功。
- 网站 **退出登录** 后再用扩展 → 应失败且文案正确。
- 扩展 **仅旧数据** → 行为与迁移说明一致。

---

## [Decision]

- **立项**：扩展侧实现 **Supabase 标准 refresh**，Web 连接时下发 **refresh_token + 公开 Supabase URL/anon key**；敏感项存 **`chrome.storage.local`**；失败降级为现有「回站连接」。

## 分支

```text
fea/chrome-ext-session-refresh-tri
```

## 相关：划词浮标 / 连接与回归测试

与「Refresh」平行迭代的划词、连接、Options 等问题归纳及 **Playwright 扩展 E2E** 见：`docs/tech/chrome-extension-e2e-and-regression.md`（本目录 `Chrome扩展插件内refresh-context.md` 中亦已挂链）。
