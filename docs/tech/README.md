# 技术分卷（PLAN 展开）

本目录为**技术口径**的按章拆页。入口、版本与变更记录见 [父级 `PLAN.md`](../PLAN.md)。

| 章节 | 文件 |
|------|------|
| 一、二 整体架构与技术选型 | [overview.md](./overview.md) |
| **分环境（本地 / Preview / 生产）** | [**environments-and-deployment.md**](./environments-and-deployment.md) |
| 三 数据库与 DDL 草案 | [database.md](./database.md) |
| 四 Phase 1：数据库地基 | [phase-1-database-baseline.md](./phase-1-database-baseline.md) |
| 五 Phase 2：Chrome 插件 | [phase-2-chrome-extension.md](./phase-2-chrome-extension.md) |
| 六 Phase 3：周报邮件 | [phase-3-weekly-digest.md](./phase-3-weekly-digest.md) |
| 七 Phase 4：外部订阅 | [phase-4-subscribe.md](./phase-4-subscribe.md) |
| 八 Phase 5：多用户笔记本 | [phase-5-notebook-multi-user.md](./phase-5-notebook-multi-user.md) |
| 九、十 规范与里程碑 | [constraints-and-milestones.md](./constraints-and-milestones.md) |
| **扩展：划词/连接回归与 E2E** | [**chrome-extension-e2e-and-regression.md**](./chrome-extension-e2e-and-regression.md) |

## 进行中（`dev/active`）

| 需求 | 目录 | 摘要 |
|------|------|------|
| Web 首页 Enter 发送 / Alt+Enter 换行 | [Web首页Enter发送Alt换行](../../dev/active/Web首页Enter发送Alt换行/) | `app/page.tsx` 键盘行为；`lib/keyboard-send-hint.ts` 桌面提示文案 |
| Chrome 扩展插件内 session refresh | [Chrome扩展插件内refresh](../../dev/active/Chrome扩展插件内refresh/) | 扩展内 Supabase refresh；涉及 `phase-2-chrome-extension` 与鉴权 |
| 周报 Cron 运维通知邮件 | [周报Cron运维通知邮件](../../dev/active/周报Cron运维通知邮件/) | Cron 汇总/失败告警邮件；`DIGEST_OPS_NOTIFY_EMAILS` |
| Future Features 本批（B/C/D） | [FUTURE-FEATURES-HANDOFF](../../dev/active/BRAINSTORM需求池/FUTURE-FEATURES-HANDOFF.md) | 代码地图与接手清单；分支 `fea/future-features`（**暂不合 `dev`**） |
| 笔记分类（B-1） | [笔记分类](../../dev/active/笔记分类/) | 已合 future：`tags[0]` + `PATCH /api/notes/[id]` |
| 划词上下文（B-2） | [划词上下文](../../dev/active/划词上下文/) | 已合 future：`surroundingText` + `prompts.ts` |
| 名词解释与消歧（C-1） | [名词解释与消歧](../../dev/active/名词解释与消歧/) | 已合 future：`DISAMBIGUATION_RULES` |
| 截图上传（C-2） | [截图上传](../../dev/active/截图上传/) | 已合 future：多模态 + `image-limits`；需 vision |
| 划词保存重复笔记校验 | [划词保存重复笔记校验](../../dev/active/划词保存重复笔记校验/) | 已合 future：扩展 `ExplainCard` 查重 |
| Chrome 扩展内登录（C-3） | [Chrome扩展内登录](../../dev/active/Chrome扩展内登录/) | 已合 future：GoTrue password grant + `CrowAuth` |
| 链接内容抓取（D-1） | [链接内容抓取](../../dev/active/链接内容抓取/) | 已合 future：`POST /api/fetch-url` + `fetch-safe` |
| 飞书等平台（D-2） | [飞书等平台](../../dev/active/飞书等平台/) | 已合 future：`/api/feishu/events` 501 stub |
| 追问树形索引 | [追问树形索引](../../dev/active/追问树形索引/) | 主卡左侧可收起树形大纲，阈值出现、点击定位+高亮；**文档先行，编码下轮** |

**立项默认**：新需求在本表增一行（与 `dev/active/…` 同批文档 commit）；结项后删除或改写。见 `.cursor/rules/dev-workflow.mdc` 阶段 3。

**单需求**的 patch 与排障仍以 `dev/done/需求名/` 及 `dev/logs/…-log.md` 为准；本目录是**可维护的技术长文档**，宜与 `docs/product/` 同步迭代。
