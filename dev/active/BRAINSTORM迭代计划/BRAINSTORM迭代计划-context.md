# BRAINSTORM 需求池 — 背景与约束

> 版本：v1.0 | 2026-04-27

## 来源

- 原始收集：`notes/BRAINSTORM-todo.md`
- 优先级与阶段划分：见同目录 `BRAINSTORM迭代计划-plan.md`

## 产品假设

- 核心用户：在网页/扩展里快速搞懂术语，并能把结果沉淀到「笔记本」。
- 本期迭代（阶段 A）聚焦：**跨平台体验硬伤修复** + **扩展内到达笔记本的闭环**。

## 约束

- 分支与发布：遵循 `.cursor/rules/git-branching.mdc`（从 `dev` 切 `fea/*`，不直接推 `main`/`dev`）。
- 阶段 A 不引入新依赖、不改 `package-lock.json`，除非后续任务明确要求。

## 待产品拍板（阶段 A 内已给默认）

| 议题 | 默认假设 | 若推翻则更新 plan |
|------|-----------|-------------------|
| 快捷键提示方案 | 按操作系统展示对应文案（Mac：`⌘↵`，Windows/Linux：`Ctrl+Enter`） | 改为两行并列展示 |
| 扩展「跳转笔记本」 | 打开 Web 笔记本列表页 ` {apiBaseUrl}/notebook `；若刚保存成功可附带笔记 id 查询参数（仅当 Web 端支持定位时实现，否则 MVP 只打开 `/notebook`） | 指定必须深链到单条笔记 |

## 交接

- 接手开发前：更新 `BRAINSTORM迭代计划-tasks.md` 状态，避免重复开工。
- 开发完成后：按 `BRAINSTORM迭代计划-qa.md` 执行测试并更新结论；与 `tasks.md` 手测勾选对表。
