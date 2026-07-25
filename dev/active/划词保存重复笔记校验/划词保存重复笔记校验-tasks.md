# 划词保存重复笔记校验 — Tasks

> 开工前：`git checkout dev && git pull` → `git checkout -b fea/ext-note-duplicate-tri`  
> **编码门禁**：用户明确批准后再改业务代码。  
> 对照：`dev/done/笔记重复检测/` 与 `components/ExplanationCard.tsx` / `DuplicateNoteModal.tsx`。

## 阶段 0：定稿

- [ ] PM：确认扩展弹层文案（都保留 / 覆盖）与是否展示旧解释全文截断长度
- [ ] TL：确认是否本期抽取共享 `normalize`（默认：可先复制）

## 阶段 1：实现

- [ ] 实现 normalize + 查重匹配（与 Web 单测对齐期望）
- [ ] `ExplainCard`：保存前查重分支
- [ ] 简易确认 UI + 覆盖删除链路
- [ ] 错误态：401 / 网络失败提示
- [ ] （可选）抽取共享 normalize 并改 Web 引用

## 阶段 2：验证与文档

- [ ] 手测：重复 / 不重复 / 覆盖 / 都保留 / 大小写空白
- [ ] 回归：Web 重复检测仍正常
- [ ] `npm run lint`；扩展 build；相关 e2e（若有）
- [ ] 更新 notebook / chrome-extension 分卷一句；写 `划词保存重复笔记校验-qa.md`
