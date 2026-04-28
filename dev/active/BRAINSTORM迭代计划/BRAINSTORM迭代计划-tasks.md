# BRAINSTORM 需求池 — 任务清单

> 版本：v1.0 | 2026-04-27  
> 详案：`BRAINSTORM迭代计划-plan.md`

## 状态说明

- [ ] 未开始
- [~] 进行中
- [x] 完成

---

## 阶段 A（当前迭代）

### A-1 Web 快捷键提示

- [ ] 从 `dev` 切分支 `fea/brainstorm-phase-a-<owner>`（按团队规范）
- [ ] 在 `app/page.tsx` 实现平台检测 + 文案（Mac：`⌘↵`，其他：`Ctrl+Enter`）
- [ ] 处理 SSR/hydration（无警告、可接受的首屏表现）
- [ ] 手测：Mac Safari/Chrome；Windows Chrome（或 DevTools UA）
- [ ] 更新本文件勾选

### A-2 Extension 打开笔记本

- [ ] 在 `chrome-extension/src/content/ExplainCard.tsx` 增加「打开笔记本」入口
- [ ] URL 使用 `config.apiBaseUrl` + `/notebook`
- [ ] 手测：划词 → 打开笔记本；保存流程仍可用；Esc 关闭正常
- [ ] 更新本文件勾选

### 阶段 A 合并前

- [ ] 核心链路 smoke（订阅/邮件若未改动可跳过，见 `qa-process.mdc`）
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
