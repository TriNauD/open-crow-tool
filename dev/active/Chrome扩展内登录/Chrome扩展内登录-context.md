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

---

## 约束

- 后端仍以 **`Authorization: Bearer` + `getUser`** 鉴权，不单独开「仅扩展」代存口。
- `NEXT_PUBLIC_SUPABASE_*` 可为扩展所知（与现网 postMessage 下发一致）；**不得在日志或 UI 中展示 refresh_token 明文**。
- 须遵守 `env-and-secrets.mdc`、`cross-platform.mdc`；实现前从 `dev` 按 `git-branching.mdc` 切功能分支。

---

## 依赖与风险

- **依赖**：Web 端已有登录方式（邮箱密码 / Magic link 等）需与扩展侧 **对齐同一 Supabase 项目**，具体对接方式在 plan 中二选一敲定（见 plan「技术选型待定」）。
- **风险**：MV3 中 OAuth / 重定向、`chrome.identity` 与自建回调页的组合需单独联调；排期宜含真机 smoke。

---

## 文档索引

- 方案与范围：[`Chrome扩展内登录-plan.md`](./Chrome扩展内登录-plan.md)
- 任务清单：[`Chrome扩展内登录-tasks.md`](./Chrome扩展内登录-tasks.md)
