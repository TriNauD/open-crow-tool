# 划词上下文 — Tasks

> 分支：`fea/selection-context-wesrindo` → merge `fea/future-features`  
> 手测：[`划词上下文-manual-test.md`](./划词上下文-manual-test.md)

## 阶段 0：定稿

- [x] 默认前后各 120；本期不做 Options 开关；不持久化 surrounding 到笔记
- [x] 字段名 `surroundingText`

## 阶段 1：服务端

- [x] `app/api/explain/route.ts`：解析并截断 `surroundingText`
- [x] `lib/ai/prompts.ts`：surrounding 段落；`__tests__/explain-prompt.test.ts`

## 阶段 2：扩展

- [x] `surrounding-text.ts`：Range 前后文 + 截断
- [x] `App.tsx` → `ExplainCard` 传递 surrounding
- [x] `useStreamExplain` 写入请求体
- [x] 降级：截取失败不抛错

## 阶段 3：验证与文档

- [x] 保姆级手测文档
- [x] `npm run lint` / `npm run test`（合入前）
- [ ] 用户手测 PASS；合 `dev` 时再补 qa / 分卷定稿
