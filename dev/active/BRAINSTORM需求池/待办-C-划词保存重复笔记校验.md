# C-划词保存重复笔记校验（BRAINSTORM 需求池）

> **编号**：C（扩展） **阶段**：C **状态**：收件箱 / 未启动

## 摘要

Chrome 扩展从划词卡片保存到笔记本（`POST /api/notes`）当前**未**与 Web 端对齐「重复笔记」校验逻辑（若站点已实现去重/合并策略，扩展侧应复用同一规则或 API 契约）。

立项后补充：与现有 `笔记本` 去重规则一致、错误码与前端提示、是否在保存前拉取轻量查重接口等。

## 关联

- 扩展保存：`chrome-extension/src/content/ExplainCard.tsx`（及 `POST /api/notes`）
- **自本池立项开发时**：须在 `dev/active/<需求简称>/` 单独建 plan / context / tasks（见 [`README.md`](./README.md)「从需求池立项」）。
