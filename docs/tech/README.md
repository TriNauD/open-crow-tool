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

**单需求**的 patch 与排障仍以 `dev/done/需求名/` 及 `dev/logs/…-log.md` 为准；本目录是**可维护的技术长文档**，宜与 `docs/product/` 同步迭代。
