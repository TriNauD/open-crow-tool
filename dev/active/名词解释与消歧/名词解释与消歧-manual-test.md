# 名词解释与消歧 — 保姆级手动测试

> Prompt 增强；Web 与扩展共用 `SYSTEM_PROMPT`。自动化：`npm run test`（`__tests__/prompts-disambiguation.test.ts`）。

## 环境

| 项 | 说明 |
|----|------|
| Web | `fea/future-features` 本地 `npm run dev`，打开首页 |
| 扩展 | 可选；同一 API 即可 |
| 前置 | AI 密钥可用；失败时换网络/看服务端日志 |

## 样例集（逐条在首页输入发送）

对每条记录：输入 → 读完整回答 → 对照「期望 incl.」。

| # | 输入 | 期望 incl.（不必逐字） |
|---|------|------------------------|
| 1 | `RAG` | 提到检索增强 / Retrieval-Augmented Generation 一类意思 |
| 2 | `API` | 点明接口 / Application Programming Interface 的大白话 |
| 3 | `Transformer`（无任何补充） | **不要**主要讲电力变压器；偏模型/架构，或半句点出多义 |
| 4 | 先问「什么是 RAG」，再对回答里某词追问 | 追问紧扣父解释，不整段跑题 |

## 扩展（可选）

1. 在含「我们用 RAG 做检索」的句子里只划 `RAG`。  
   **预期**：解释更贴检索增强；Network `surroundingText` 可有可无（B-2）。

## 失败看哪里

- 回答质量差但单测绿：属模型波动，多试 1～2 次；规则是否仍在 `lib/ai/prompts.ts` 的 `DISAMBIGUATION_RULES`。
- 请求 500：providers / API key。

## 结论

| 日期 | URL | 结论 | 备注 |
|------|-----|------|------|
| | | PASS / FAIL | |
