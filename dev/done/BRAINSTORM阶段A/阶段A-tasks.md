# BRAINSTORM 需求池 — 任务清单

> 版本：v1.0 | 2026-04-27  
> 详案：`阶段A-plan.md`  
> QA：`阶段A-qa.md` · 需求池总表：[`../../active/BRAINSTORM需求池/README.md`](../../active/BRAINSTORM需求池/README.md)

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
- [x] 手测：`阶段A-qa.md` §0.2 / **TC-A1** — 用户验收 **PASS**（Mac/手机；Win/Linux 由 E2E/Vitest 背书）

### A-2 Extension 打开笔记本

- [x] 在 `chrome-extension/src/content/ExplainCard.tsx` 增加「打开笔记本」入口
- [x] URL 使用 `config.apiBaseUrl` + `/notebook`
- [x] 手测：`阶段A-qa.md` §0.2 / **TC-A2**、**RT-A1** — **PASS**

### 阶段 A 合并前

- [x] QA `§0` 执行记录与 `§4`：**PASS**，见 `阶段A-qa.md`
- [ ] （可选）核心链路 smoke：订阅/邮件未改可豁免，理由写进 PR（见 `qa-process.mdc`）
- [ ] PR：背景、改动点、验收结果、回滚方式（由负责人发起；见 `git-branching.mdc`）

---

## 阶段 B（排期后启用）

条目与占位文档：`dev/active/BRAINSTORM需求池/` 下 [`待办-B-笔记分类.md`](../../active/BRAINSTORM需求池/待办-B-笔记分类.md)、[`待办-B-划词上下文.md`](../../active/BRAINSTORM需求池/待办-B-划词上下文.md)。

- [ ] 笔记分类 MVP（产品口径 + DB + UI）
- [ ] 划词上下文：默认策略（自动 N 字 vs 用户补充）+ 扩展实现草案

## 阶段 C（排期后启用）

[`待办-C-名词解释与消歧.md`](../../active/BRAINSTORM需求池/待办-C-名词解释与消歧.md)、[`待办-C-截图上传.md`](../../active/BRAINSTORM需求池/待办-C-截图上传.md)。

- [ ] 名词解释 / 缩写 / 消歧（独立验收文档）
- [ ] 截图上传（存储与模型策略定稿后）

## 阶段 D（单独立项）

[`待办-D-链接内容抓取.md`](../../active/BRAINSTORM需求池/待办-D-链接内容抓取.md)、[`待办-D-飞书等平台.md`](../../active/BRAINSTORM需求池/待办-D-飞书等平台.md)。

- [ ] 链接内容抓取（安全与合规评审）
- [ ] 飞书等平台（需求与资源确认后）
