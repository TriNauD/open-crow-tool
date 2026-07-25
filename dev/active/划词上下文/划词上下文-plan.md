# 划词上下文 — Plan

> **分支建议**：`fea/selection-surrounding-context-tri`  
> **池条目**：B-2

## 目标

1. 扩展划词解释时，自动附带选区**前后纯文本**（可配置上限），提升短词准确度。
2. API / prompt **明确区分**「页面前后文」与「追问父解释 `context`」。
3. 取不到前后文时**静默降级**为仅选区（行为与现网一致）。

## 非目标

- 上传截图/DOM HTML/整页 markdown。
- Web 首页输入框的「模拟前后文」。
- 用户手写编辑前后文的完整编辑器（MVP 不做；可二期）。

---

## [PM] 验收要点（草案）

- 在普通网页划短词：请求体含 surrounding；解释明显参考句意（抽样手测）。
- Options（或内置常量）可关闭附带前后文。
- Web 钻取追问（`context`=父解释）回归通过。
- 跨域 iframe 取失败时仍能解释选区。

---

## [TL] 技术方案

### 扩展侧截取

- 在 `App.tsx` 选区成功后，用 `Range` / `anchorNode` 向父文本节点取前后字符（纯文本），拼 `surroundingText`（或 `before`+`after`）。
- 硬上限：前后各 N（默认 120）；超长截断；不包含选区本身重复（prompt 里分栏写清）。
- 传入 `ExplainCard` → `useStreamExplain(text, { surroundingText })`。

### API / Prompt

```json
POST /api/explain
{
  "text": "选区",
  "context": "可选，父解释（追问）",
  "surroundingText": "可选，页面前后文"
}
```

- `lib/ai/prompts.ts`：若有 `surroundingText`，增加一小段说明：「以下是划词附近的原文片段，仅用于消歧；请以划词为主」。
- `context` 与 `surroundingText` 可同时存在（扩展追问若未来做）：prompt 顺序建议 **surrounding → parent context → 选区**。

### 涉及文件（预估）

- `chrome-extension/src/content/App.tsx`
- `chrome-extension/src/content/ExplainCard.tsx`
- `chrome-extension/src/content/useStreamExplain.ts`
- `app/api/explain/route.ts`（解析新字段）
- `lib/ai/prompts.ts`
- 可选：Options 开关 UI
- 文档：`docs/product/chrome-extension.md`、`docs/tech/phase-2-chrome-extension.md`（定稿时一句）
- 测试：prompt 单测；扩展 E2E 若可构造 fixture 再加

### 风险与回滚

- 回滚：忽略 `surroundingText` 即恢复旧行为；扩展可不发该字段。

---

## [QA] 影响域

- 扩展划词 / Alt+W / 未登录解释 / 保存笔记（保存仍只存选区文本，**不必**存 surrounding，除非产品另定）。
- Web `/api/explain` 契约与 CORS。

## [Decision]

- 新字段 `surroundingText` + 自动截取默认开；N=120 待阶段 0 确认。
