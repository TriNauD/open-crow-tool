# BRAINSTORM 需求池 — 背景与约束

> 版本：v1.0 | 2026-04-27

## 来源

- 原始收集：`notes/BRAINSTORM-todo.md`
- 优先级与阶段划分：见 [`dev/active/BRAINSTORM需求池/roadmap.md`](../../active/BRAINSTORM需求池/roadmap.md)（矩阵）；本目录仅保留 **阶段 A** 正文

## 产品假设

- 核心用户：在网页/扩展里快速搞懂术语，并能把结果沉淀到「笔记本」。
- 本期迭代（阶段 A）聚焦：**跨平台体验硬伤修复** + **扩展内到达笔记本的闭环**。

## 约束

- 分支与发布：遵循 `.cursor/rules/git-branching.mdc`（从 `dev` 切 `fea/*`，不直接推 `main`/`dev`）。
- 阶段 A 早期约定「尽量不改 lockfile」；最终交付含 **Playwright E2E**（`@playwright/test`）等，以实际 `package-lock.json` 为准。

## 待产品拍板（阶段 A 内已给默认）

| 议题 | 默认假设 | 若推翻则更新 plan |
|------|-----------|-------------------|
| 快捷键提示方案 | 桌面：Mac → `⌘↵`，Win/Linux → `Ctrl+Enter`；**手机浏览器：不展示提示** | 两行并列；或平板单独策略 |
| 扩展「跳转笔记本」 | 打开 Web 笔记本列表页 ` {apiBaseUrl}/notebook `；若刚保存成功可附带笔记 id 查询参数（仅当 Web 端支持定位时实现，否则 MVP 只打开 `/notebook`） | 指定必须深链到单条笔记 |

## 交接

- 接手开发前：更新 `阶段A-tasks.md` 状态，避免重复开工。
- 开发完成后：按 `阶段A-qa.md` 执行测试并更新结论；与 `tasks.md` 手测勾选对表。

## 结项

- **2026-04-28**：阶段 A **用户验收 PASS**（见 `阶段A-qa.md`）；结项目录为 `dev/done/BRAINSTORM阶段A/`；结项提要见 `dev/logs/BRAINSTORM阶段A-log.md`。需求池总索引：[`dev/active/BRAINSTORM需求池/README.md`](../../active/BRAINSTORM需求池/README.md)。
