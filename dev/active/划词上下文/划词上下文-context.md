# 划词上下文 — Context

> **来源**：BRAINSTORM 需求池 **B-2**（[`待办-B-划词上下文.md`](../BRAINSTORM需求池/待办-B-划词上下文.md)）  
> **立项性质**：**前瞻立项文档**（文档先行）。待阶段 2 / 排期确认后再编码。

## 背景 / 痛点

- 扩展划词只上传**选中纯文本**；短词（如「RAG」「token」）脱离段落时，模型容易误解释。
- 用户期望「带一点前后文」提升准确度，同时控制隐私与 token 成本。

## 现状（调研）

| 项 | 结论 |
|----|------|
| 选区 | `chrome-extension/src/content/App.tsx`：`getSelection()` → `{ text, x, y }`，**无** surrounding / URL |
| 解释请求 | `ExplainCard` → `useStreamExplain`：`POST /api/explain` body `{ text, context? }` |
| `context` 语义 | **已被 Web 追问占用**：`lib/ai/prompts.ts` 的 `parentContext`（父段解释），扩展当前几乎不传 |
| 提示词 | 无「页面前后文」槽位 |

## 约束

- **命名冲突**：页面前后文**不得**复用现有 `context` 字段语义，以免破坏 Web 钻取追问。建议新字段如 `surroundingText` / `pageContext`。
- 前后文截取须有**硬上限**（字符数），避免扫整页进 prompt。
- 跨域 iframe / 特殊文档（PDF viewer）可能取不到 surrounding——须降级为仅选区。
- 隐私：不默默上传整页 HTML；只传纯文本前后文。

## 关键决策（待用户确认）

| 选项 | 说明 | 推荐默认 |
|------|------|----------|
| **策略** | 自动截取前后 N 字 vs 用户点「补上下文」再截 | **自动截取**（可 Options 关） |
| **N 默认** | 前后各 80 / 120 / 200 字 | **前后各 120**（合计 ≤ ~240 + 选区） |
| **字段** | 扩展 `surroundingText`；prompt 单独段落 | **推荐** |
| **是否改 Web** | Web 首页无 DOM 选区；本期仅扩展 | **仅扩展** |

## 依赖与风险

- **依赖**：扩展 content script；`app/api/explain` + `buildExplainPrompt` 小改。
- **风险**：错误截取（含广告/导航）干扰解释；须在 prompt 标明「仅供消歧，以划词为准」。
- **与 C-1**：消歧提示词可叠加 surrounding；可并行但建议 B-2 先定字段契约。

## 文档索引

- [`划词上下文-plan.md`](./划词上下文-plan.md)
- [`划词上下文-tasks.md`](./划词上下文-tasks.md)
