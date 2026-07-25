# BRAINSTORM 需求池 — 路线图（A～D）

> 与 [`README.md`](./README.md) 条目表一致；**全局矩阵与阶段目标**以本文件为准。  
> **阶段 A 的详细方案与验收**已归档至 [`dev/done/BRAINSTORM阶段A/阶段A-plan.md`](../../done/BRAINSTORM阶段A/阶段A-plan.md)（仅含 A-1、A-2）。  
> **B/C/D 本批编码**：已汇入 `fea/future-features` — 见 [`future-features-integration.md`](./future-features-integration.md) 与 [`FUTURE-FEATURES-HANDOFF.md`](./FUTURE-FEATURES-HANDOFF.md)。

**开发节奏**：自池中选中某条准备实现时，须在 `dev/active/<需求简称>/` **单独立项建档**（plan / context / tasks，及后续 qa），并回填 [`README.md`](./README.md) 条目表。细则见 README 章节「从需求池立项（必做）」。

## 1. 需求矩阵（重要度 × 可行性）

| 条目 | 编号 | 重要度 | 可行性 | 阶段 |
|------|------|--------|--------|------|
| Web：输入区快捷键提示仅写 ⌘（Windows 不适配）等 | A-1 | 高 | 高 | **A** ✅ |
| Extension：划词弹窗「打开笔记本」 | A-2 | 中高 | 中高 | **A** ✅ |
| Web：笔记分类 | B-1 | 中 | 中 | B（已合 future） |
| Extension：划词上下文 / 补前后文 | B-2 | 中 | 中 | B（已合 future） |
| Web：输出优化 — 名词解释、缩写、多领域消歧 | C-1 | 高 | 中低 | C（已合 future） |
| Web：上传截图 | C-2 | 中高 | 中 | C（已合 future） |
| Extension：扩展内登录（主路径），保留网站连接 | C-3 | 高 | 中 | C（已合 future） |
| AI：真实读取用户粘贴的链接 | D-1 | 高 | 中低 | D（已合 future） |
| 跨平台：划词接入飞书等 | D-2 | 视场景 | 低～中 | D（stub / No-Go 已合 future） |

## 2. 阶段总览

| 阶段 | 目标 | 包含项（摘要） | 状态 |
|------|------|----------------|------|
| **A** | 快赢 + 闭环 | 快捷键文案；扩展跳转笔记本 | **已结项** |
| **B** | 组织与理解输入 | 笔记分类 MVP；划词上下文策略 MVP | **已合 `fea/future-features`**（手测 / 合 `dev` 待做） |
| **C** | 输出与多模态 + 扩展登录 | 名词解释/消歧；截图；重复校验；**C-3 扩展内登录** | **已合 `fea/future-features`**（手测 / 合 `dev` 待做） |
| **D** | 集成与安全 | 链接抓取；飞书 stub/No-Go | **已合 future**（D-2 完整实现搁置） |

## 3. 阶段 B / C / D — 索引（已合 future；详见 handoff）

- **接手**：[**`FUTURE-FEATURES-HANDOFF.md`**](./FUTURE-FEATURES-HANDOFF.md) · 进度表 [`future-features-integration.md`](./future-features-integration.md)
- **B**：[`../笔记分类/`](../笔记分类/)（`tags[0]` MVP）；[`../划词上下文/`](../划词上下文/)（`surroundingText`）。背景：[`待办-B-笔记分类.md`](./待办-B-笔记分类.md)、[`待办-B-划词上下文.md`](./待办-B-划词上下文.md)。
- **C**：[`../名词解释与消歧/`](../名词解释与消歧/)、[`../截图上传/`](../截图上传/)、[`../划词保存重复笔记校验/`](../划词保存重复笔记校验/)、[`../Chrome扩展内登录/`](../Chrome扩展内登录/)。背景：[`待办-C-*.md`](./待办-C-名词解释与消歧.md)。
- **D**：[`../链接内容抓取/`](../链接内容抓取/)（`/api/fetch-url` + SSRF）；[`../飞书等平台/`](../飞书等平台/)（501 stub + evaluation）。背景：[`待办-D-*.md`](./待办-D-链接内容抓取.md)。
