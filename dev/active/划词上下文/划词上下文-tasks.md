# 划词上下文 — Tasks

> 开工前：`git checkout dev && git pull` → `git checkout -b fea/selection-surrounding-context-tri`  
> **编码门禁**：用户明确批准后再改业务代码。

## 阶段 0：定稿

- [ ] PM：确认默认 N（建议前后各 120）、是否 Options 开关、是否持久化 surrounding 到笔记（默认否）
- [ ] TL：确认字段名 `surroundingText` 与 prompt 模板终稿

## 阶段 1：服务端

- [ ] `app/api/explain/route.ts`：解析并校验 `surroundingText` 最大长度
- [ ] `lib/ai/prompts.ts`：接入前后文段落；单测覆盖有/无 surrounding、有/无 parent context

## 阶段 2：扩展

- [ ] 选区工具函数：从 Range 取前后纯文本 + 截断
- [ ] `App.tsx` → `ExplainCard` 传递 surrounding
- [ ] `useStreamExplain` 写入请求体
- [ ] （可选）Options：关闭「附带前后文」
- [ ] 降级：截取失败不抛错，仅发 `text`

## 阶段 3：验证与文档

- [ ] 手测：普通 HTML 页短词；跨域 iframe 降级；Web 追问回归
- [ ] `npm run lint`；扩展相关则按约定 build + e2e
- [ ] 更新产品/技术分卷一句；写 `划词上下文-qa.md`
