# 产品分卷（PRD 展开）

本目录为**产品口径**的按域拆页。入口与版本信息见 [父级 `PRD.md`](../PRD.md)。

| 域 | 文件 | 内容摘要 |
|----|------|----------|
| Web 解释器 | [web-explainer.md](./web-explainer.md) | 流式解释、划词追问、体验要求 |
| Chrome 划词扩展 | [chrome-extension.md](./chrome-extension.md) | 触发、卡片、网站「连接插件」与 Bearer |
| 周报、订阅与规划 | [weekly-digest.md](./weekly-digest.md) | GitHub 周报、外部订阅、日报设想 |
| 笔记本 | [notebook.md](./notebook.md) | 数据结构、列表与搜索、重复检测 |
| 认证与身份 | [auth.md](./auth.md) | 多用户、游客、扩展与网站对齐 |
| 非功能与范围 | [nfr-and-out-of-scope.md](./nfr-and-out-of-scope.md) | 成本、可扩展、明确不做 |

## 进行中（`dev/active`）

| 需求 | 目录 | 摘要 |
|------|------|------|
| Web 首页 Enter 发送 / Alt+Enter 换行 | [Web首页Enter发送Alt换行](../../dev/active/Web首页Enter发送Alt换行/) | 首页主输入：Enter 发送，Alt+Enter（及 Shift+Enter）换行；角标与 Vitest/E2E 对齐 |
| Chrome 扩展插件内 session refresh | [Chrome扩展插件内refresh](../../dev/active/Chrome扩展插件内refresh/) | 扩展内 Supabase refresh，减少散发使用下的过期重连 |
| 周报 Cron 运维通知邮件 | [周报Cron运维通知邮件](../../dev/active/周报Cron运维通知邮件/) | 运营/开发收件箱收每周发送结果摘要 |

**立项默认**：新需求在本表增一行（同一批 commit 含 `dev/active/…`）；结项迁至 `dev/done/` 后删除或改写本行。详见仓库根目录 `.cursor/rules/dev-workflow.mdc` 阶段 3。

**单需求**的定稿细节仍以 `dev/done/需求名/`（及 `dev/active/…` 进行中）下的 context / plan / qa 为准；本目录是**持续维护的模块总述**，大改时在对应分卷中增补并可在总 `PRD.md` 的变更记录中带一句。
