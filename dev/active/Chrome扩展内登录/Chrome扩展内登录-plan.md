# Chrome 扩展内登录 — Plan

> **用户批准立项**：2026-04-27（对话确认「ok，就这么做」）  
> **分支**：实现前从 `dev` 切出，建议 `fea/chrome-ext-standalone-login-<owner>`（以 `.cursor/rules/git-branching.mdc` 为准）

## 目标

1. 用户在 **扩展内** 用非技术方式完成登录（**不写**、**不抄** Token），获得与网站同一账号的划词存笔记能力。  
2. **保留** 网站「连接插件」一键同步，作为已登录网站用户的快捷路径。  
3. **手动粘贴 Token** 仅保留在折叠「高级」区域，不作为主路径。

---

## [PM] 功能与验收口径

### 用户故事

- 作为新用户，我打开扩展设置，应能 **直接登录或打开登录页**，完成后状态显示为已连接，无需理解 access_token。  
- 作为已在网站登录的用户，我仍可通过 **网站「连接插件」** 同步状态；打开扩展设置时应 **自动反映** 最新连接（与现有 `storage` 监听一致）。  
- 作为自托管/开发者，我可在「高级」中 **手动配置** API 地址与令牌（现有能力保留但弱化）。

### 对外用语

- 主界面：**登录 / 已登录 / 退出登录 / 重新登录**；继续避免向普通用户暴露「Bearer、refresh、JWT」。  
- 网站侧仍可用 **「连接插件」**；与扩展内登录二选一或组合使用均可，文案上可写「或与网站同步」。

### 验收（草案）

- 扩展内完成登录后，`POST /api/notes` 成功，且 `loadCrowAuth()` 含可刷新字段时，长时间使用后仍能通过 **`ensureFreshAuth`** 续期（与现行为一致或更好）。  
- 网站「连接插件」仍可用，且与扩展内登录 **后写覆盖** 规则可预期、无死循环错误。  
- 手动高级入口默认 **折叠**；主路径无「打开 DevTools / Local Storage」类指引。

---

## [TL] 技术方案（骨架）

### 存储与数据形态

- **不改** `CrowAuth` 与 `persistCrowAuth` 契约：登录成功后写入 `apiBaseUrl`、`accessToken`、`refreshToken`、`supabaseUrl`、`supabaseAnonKey`、`expiresAt`（与 `AuthNav` 经桥接下发字段对齐）。  
- **apiBaseUrl**：扩展内登录成功后默认 `NEXT_PUBLIC_SITE` / 构建时配置的 Crow 站点 origin；自托管高级路径允许覆盖。

### 扩展内登录实现（立项后第一步：选型定稿）

以下二选一或组合，在 **`Chrome扩展内登录-tasks.md`** 打勾前需敲定一项为主实现：

| 方案 | 要点 | 权衡 |
|------|------|------|
| **A. Auth UI 在 Options + Supabase client** | 在扩展 Options 内嵌邮箱密码或 Magic link 表单，直接调 Supabase `signIn*`；拿到 session 后映射为 `CrowAuth` 并 `persistCrowAuth`。 | 与网站同库，实现相对集中；需注意扩展页 CSP、重定向邮箱链接是否回弹到扩展页。 |
| **B. `chrome.identity.launchWebAuthFlow` + PKCE** | 在 Crow 域名完成 OAuth / _magic link 回调_，回调 URL 捕获 token 写回扩展 storage。 | 与「网站登录」体验统一；工程上回调 URL、扩展 ID 登记需配置。 |

**不推荐**：引导用户从 DevTools 复制 `sb-*-auth-token` 作为主路径（本期仅允许留在高级区）。

### 改动面（预估）

| 区域 | 说明 |
|------|------|
| `chrome-extension/src/options/Options.tsx` | 主界面：登录 / 状态 / 退出；「高级」折叠保留手动配置。 |
| `chrome-extension` | 新增或抽取登录表单组件、错误与 loading；必要时 `manifest` 权限（如 `identity`）。 |
| Web | 若采用方案 B，可能需要 **固定回调路由**、允许扩展重定向白名单；具体见 tasks 定稿。 |
| 文档 | `docs/product/chrome-extension.md` 等按需更新安装与登录说明。 |

### 明确不做（本期）

- 多账号并行切换（同一扩展配置文件仅保留「当前会话」）。  
- 游客离线笔记本。  
- 替换 Supabase 为其他 IdP（除非选型 B 顺带兼容）。

---

## [QA] 影响域（立项备忘）

- 扩展 Options / Popup 连接状态、`ExplainCard` 存笔记、`crow-session` 刷新与 401 提示、网站 `AuthNav` 连接桥接。  
- 回归：**网站连接 → 存笔记**、**扩展登录 → 存笔记**、**先网站后扩展登录覆盖**、**先扩展后网站连接覆盖**、刷新与过期引导。

---

## [Decision]

- **立项执行**：扩展内登录为主路径 + 保留网站连接 + 手动降级；存储与鉴权契约与现有多用户扩展对齐。  
- **技术细节**：以 tasks 中「登录方案定稿」为门禁后再大面积编码。
