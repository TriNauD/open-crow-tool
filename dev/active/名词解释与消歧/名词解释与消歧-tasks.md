# 名词解释与消歧 — Tasks

> 开工前：`git checkout dev && git pull` → `git checkout -b fea/term-disambiguation-tri`  
> **编码门禁**：用户明确批准后再改业务代码。

## 阶段 0：定稿

- [ ] PM：确认方案 A/B/C；确认「不确定勿编造全称」文案强度
- [ ] PM：冻结手测样例表（≥6 条）写入后续 qa
- [ ] TL：确认是否要 env 灰度开关

## 阶段 1：实现

- [ ] 更新 `lib/ai/prompts.ts`（system 规则 + user 侧必要时一句）
- [ ] 与 B-2 字段对齐：若 `surroundingText` 已合入则接入消歧说明；未合入则预留注释/分支
- [ ] 单测：关键规则字符串存在；buildExplainPrompt 快照不炸

## 阶段 2：验证与文档

- [ ] 手测样例集（Web + 扩展各跑一轮关键条）
- [ ] 回归：普通非缩写输入长度与语气仍符合品牌
- [ ] `npm run lint` / `npm run test`
- [ ] 更新 `docs/product/web-explainer.md`；写 `名词解释与消歧-qa.md`
