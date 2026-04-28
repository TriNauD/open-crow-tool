# BRAINSTORM 需求池 — 任务清单

> 版本：v1.0 | 2026-04-27  
> 详案：`BRAINSTORM迭代计划-plan.md`  
> QA：`BRAINSTORM迭代计划-qa.md`

## 状态说明

- [ ] 未开始
- [~] 进行中
- [x] 完成

---

## 阶段 A（当前迭代）

### A-1 Web 快捷键提示

- [x] 从 `dev` 切分支 `fea/brainstorm-phase-a-tri`（按团队规范）
- [x] 在 `app/page.tsx` 实现平台检测 + 文案（Mac：`⌘↵`，其他：`Ctrl+Enter`）
- [x] 处理 SSR/hydration（无警告、可接受的首屏表现）
- [ ] 手测：`BRAINSTORM迭代计划-qa.md` §0.2（Web）；Mac Safari/Chrome；Windows Chrome（「仅 UA」不能完全代替实机）

### A-2 Extension 打开笔记本

- [x] 在 `chrome-extension/src/content/ExplainCard.tsx` 增加「打开笔记本」入口
- [x] URL 使用 `config.apiBaseUrl` + `/notebook`
- [ ] 手测：`BRAINSTORM迭代计划-qa.md` §0.2（扩展）— 打开笔记本 / 存入 / Esc

### 阶段 A 合并前

- [ ] 填写 QA `§0` 执行记录与 `§4` 结论（PASS/FAIL）
- [ ] （可选）核心链路 smoke：订阅/邮件未改可豁免，理由写进 PR（见 `qa-process.mdc`）
- [ ] PR：背景、改动点、手测结果、回滚方式（文案 + 扩展 UI 可快速回滚）

---

## 阶段 B（排期后启用）

- [ ] 笔记分类 MVP（产品口径 + DB + UI）
- [ ] 划词上下文：默认策略（自动 N 字 vs 用户补充）+ 扩展实现草案

## 阶段 C（排期后启用）

- [ ] 名词解释 / 缩写 / 消歧（独立验收文档）
- [ ] 截图上传（存储与模型策略定稿后）

## 阶段 D（单独立项）

- [ ] 链接内容抓取（安全与合规评审）
- [ ] 飞书等平台（需求与资源确认后）
