# 这是啥？— 产品需求文档 (PRD)

> 版本：v1.7 | 作者：PM | 最后更新：2026-05-16  
> **v1.7**：**Chrome 扩展暂停划词开关** 结项（Popup/Options 开关、未连接可看解释、保存引导连接、重载后旧页与开关同步）；归档 [`dev/done/Chrome扩展暂停划词开关/`](../dev/done/Chrome扩展暂停划词开关/)、日志 [`dev/logs/Chrome扩展暂停划词开关-log.md`](../dev/logs/Chrome扩展暂停划词开关-log.md)；分卷 [`docs/product/chrome-extension.md`](./product/chrome-extension.md)。  
> **v1.6**：**C-3 Chrome 扩展内登录** 已立项（扩展内主路径登录 + 保留网站「连接插件」）；总览与 [`docs/product/chrome-extension.md`](./product/chrome-extension.md)；主目录 [`dev/active/Chrome扩展内登录/`](../dev/active/Chrome扩展内登录/)。  
> **v1.5**：产品口径**按域拆卷**到 [`docs/product/`](./product/README.md)，本文件为**总览与导航**，避免单文件无限膨胀。  
> **2026-04-28**：BRAINSTORM **阶段 A 已结项**（其余阶段 B～D 仍排期）；总索引 [`dev/active/BRAINSTORM需求池/README.md`](../dev/active/BRAINSTORM需求池/README.md)，归档 [`dev/done/BRAINSTORM阶段A/`](../dev/done/BRAINSTORM阶段A/)。

---

## 一、产品定位

**一句话**：把任何让你头大的 AI 术语、新工具、技术文章，用大白话解释清楚，并帮你系统积累。

**目标用户（当前阶段）**：开发者/技术从业者，频繁刷 X / HN / GitHub，需要随时搞懂陌生术语，但不想离开当前页面去 Google 或切换标签页。

**商业模式（当前阶段）**：个人自用 → 开放外部订阅周报（Phase 4 ✅）→ 周报生产就绪（✅）→ 付费订阅制（Phase 5）。

---

## 二、分卷阅读（主入口）

| 域 | 路径 |
|----|------|
| **产品分卷目录与说明** | [`docs/product/README.md`](./product/README.md) |
| Web 解释器 | [`docs/product/web-explainer.md`](./product/web-explainer.md) |
| Chrome 划词扩展 | [`docs/product/chrome-extension.md`](./product/chrome-extension.md) |
| 周报、订阅与规划 | [`docs/product/weekly-digest.md`](./product/weekly-digest.md) |
| 笔记本 | [`docs/product/notebook.md`](./product/notebook.md) |
| 认证与身份 | [`docs/product/auth.md`](./product/auth.md) |
| 非功能与 out of scope | [`docs/product/nfr-and-out-of-scope.md`](./product/nfr-and-out-of-scope.md) |

**新需求/结项**时：在对应分卷中更新结论；若动到跨模块原则，在总述本节或相关分卷首段补一句**变更说明**与日期。需求级别的细节与测试结论仍以 `dev/done/需求名/` 为准。

**进行中的需求轨道（摘要）**：**C-3** — Chrome 扩展内 **Options 非技术流登录**（默认推荐），网站 **「连接插件」** 保留为快捷同步，**手动 Token** 降级至高级区；详见 [`dev/active/Chrome扩展内登录/Chrome扩展内登录-plan.md`](../dev/active/Chrome扩展内登录/Chrome扩展内登录-plan.md)。

---

## 三、与团队流程的关系

产品交付管道见 `.cursor/rules/product-delivery-pipeline.mdc`；用户批准方案后，对 **PRD 的 commit** 体现为对 **本总览** 和/或 **`docs/product/*` 分卷** 的更新。
