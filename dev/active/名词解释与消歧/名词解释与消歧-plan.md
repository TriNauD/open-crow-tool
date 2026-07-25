# 名词解释与消歧 — Plan

> **分支建议**：`fea/term-disambiguation-tri`  
> **池条目**：C-1

## 目标

1. 解释缩写/专名时，在大白话框架内**尽量给出通行全称或领域锚点**。
2. 多义术语：优先依据 `context` / `surroundingText`（若有）选定义项；无语境时明确默认领域或一句点出歧义。
3. Web 与扩展共用同一 prompt，行为一致。

## 非目标

- 完整百科、多语言词库后台、用户自定义术语库（二期）。
- 强制 JSON 多轮澄清 UI（除非阶段 0 改选方案 B）。

---

## [PM] 验收要点（草案）

准备固定样例集（写入 qa），例如：

| 输入 | 期望 incl. |
|------|------------|
| `RAG` | 点明 Retrieval-Augmented Generation 或检索增强，而非无关义 |
| `Transformer`（无语境） | 不与电力变压器硬扯；或一句说明也可能指其他 |
| `API` | 点明 Application Programming Interface 且面向非技术读者 |
| 追问子词 | 仍尊重父 `context`，不跑题 |

---

## [TL] 技术方案

### MVP（方案 A）

1. 扩展 `SYSTEM_PROMPT` 或拆出 `DISAMBIGUATION_RULES` 拼入 system：
   - 遇缩写：给常用全称；不确定则写「一般指…」勿编造冷门全称。
   - 多义：有前后文/父解释则按语境；否则选科技/AI 产品语境为默认，并可加半句其他可能。
   - 输出仍禁 Markdown、仍 3～5 句。
2. `buildExplainPrompt`：若未来有 `surroundingText`，提示「用于消歧」。
3. **不改**流式协议（仍 `text/plain`）。

### 涉及文件

- `lib/ai/prompts.ts`（主）
- 可选：`__tests__/prompts-disambiguation.test.ts`（快照/关键子串断言）
- `docs/product/web-explainer.md`（定稿一句）
- 不改 DB；`app/api/explain/route.ts` 仅当要把规则开关做成 env 时微调

### 风险与回滚

- 回滚：还原 prompt 段落即可。
- A/B：可用 env `EXPLAIN_DISAMBIGUATION=1` 灰度（可选）。

---

## [QA] 影响域

- 全站解释质量（Web + 扩展）；周报 prompt **不在范围**（除非误改同一文件时注意别碰 `buildWeeklyDigestPrompt` 行为）。

## [Decision]

- MVP 走 **纯 Prompt 增强 + 样例手测集**；澄清 UI / glossary 列入二期。
