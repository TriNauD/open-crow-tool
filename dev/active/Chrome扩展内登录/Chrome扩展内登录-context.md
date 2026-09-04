# Chrome 扩展内登录 — Context

## 背景

- 已完成 [`dev/done/Chrome扩展多用户鉴权`](../../done/Chrome扩展多用户鉴权/)：网站「连接插件」经 `postMessage` 写入 `chrome.storage.local`，与会话刷新（`crow-session`）打通。
- 用户反馈：**手动填写** Token / Local Storage 路径对非开发者不友好；希望 **在扩展内能像普通 App 一样登录**，同时 **保留** 已在网站登录时的一键同步。
- 本需求在原有多用户鉴权之上增加 **扩展内主路径登录**，不推翻现有存储模型与 API 契约。

---

## 关键决策（立项共识）

| 决策 | 内容 |
|------|------|
| 双入口 | **扩展内登录** 为默认推荐路径；**网站「连接插件」** 保留为快捷同步；两者写入同一套 `CrowAuth` 形态（`crow-session` / `persistCrowAuth`）。 |
| 冲突规则 | **以最后一次成功写入为准**（后写覆盖）；不在本期做「双账号合并」；Options 可展示简短说明。 |
| 手动配置 | **移出主流程**，折叠为「高级 / 开发者 / 自托管」，文案避免要求用户理解 JWT、`sb-*-auth-token`。 |
| 长效使用 | 与现网一致：依赖 **access + refresh** 与扩展内 `ensureFreshAuth`；refresh 失效时引导 **在扩展内重新登录** 或 **网站连接**（二选一即可达成重授权）。 |

## 实现决策（2026-07-25）

| 决策 | 内容 |
|------|------|
| **登录方案** | **方案 A**：Options 内嵌邮箱/密码表单 → GoTrue `POST /auth/v1/token?grant_type=password`（纯 fetch，与 refresh 同风格）→ 映射 `CrowAuth` → `persistCrowAuth`。 |
| 不选 B 的原因 | MVP 无需 `chrome.identity`、无需 Web 固定回调路由与扩展 ID 白名单；邮箱密码与网站 `/login` 对齐即可。 |
| Magic link | **本期不做**（扩展页邮箱确认回调 / CSP 风险高）；未验证邮箱给出可读提示，引导在网站完成验证。 |
| 依赖 | **不**新增 `@supabase/supabase-js` 到扩展包。 |
| apiBaseUrl | 默认 `VITE_PUBLIC_SITE_ORIGIN`（缺省回落 `https://dev.crowknows.tech`）；高级区可覆盖。 |

---

## 约束

- 后端仍以 **`Authorization: Bearer` + `getUser`** 鉴权，不单独开「仅扩展」代存口。
- `NEXT_PUBLIC_SUPABASE_*` 可为扩展所知（与现网 postMessage 下发一致）；**不得在日志或 UI 中展示 refresh_token 明文**。
- 须遵守 `env-and-secrets.mdc`、`cross-platform.mdc`；实现前从 `dev` 按 `git-branching.mdc` 切功能分支。

---

## 依赖与风险

- **依赖**：Web 与扩展对齐**同一 Supabase 项目**；扩展构建注入 `VITE_PUBLIC_SUPABASE_*` + `VITE_PUBLIC_SITE_ORIGIN`（见 `chrome-extension/.env.example`）。登录方案已定稿为 **方案 A**（见上文「实现决策」）。
- **风险**：邮箱未验证时仅提示去网站点邮件（扩展不做 Magic link 回调）；与网站「连接插件」后写覆盖需手测；合 `dev` 前注意与 [PR #31](https://github.com/TriNauD/open-crow-tool/pull/31)（注册确认密码，仅网站）的 merge 顺序。

---

## 文档索引

- 方案与范围：[`Chrome扩展内登录-plan.md`](./Chrome扩展内登录-plan.md)
- 任务清单：[`Chrome扩展内登录-tasks.md`](./Chrome扩展内登录-tasks.md)
