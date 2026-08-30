# 笔记分类 — Context

> **来源**：BRAINSTORM 需求池 **B-1**（[`待办-B-笔记分类.md`](../BRAINSTORM需求池/待办-B-笔记分类.md)）  
> **立项性质**：**前瞻立项文档**（文档先行）。待用户阶段 2 / 排期确认后再编码，禁止在 `dev` 直改业务代码。

## 背景 / 痛点

- 笔记本列表已支持搜索与来源徽章（Web / 插件），但笔记长期堆积后**无法按主题归类**，只能靠关键词搜索。
- DB 已有 `tags text[]`（默认 `{}`），产品分卷写明「预留，暂不做 UI」——本需求把「分类」从预留字段落到可筛选体验。

## 现状（调研）

| 项 | 结论 |
|----|------|
| Schema | `notes.tags` 已存在；**无** `category` / `folder` / `notebook_id` |
| API | `GET/POST /api/notes` **未**读写 `tags`；`NoteEntry` 含 `tags` 但写入常硬编码 `[]` |
| UI | `app/notebook/page.tsx` 无分类筛选；保存路径（Web `ExplanationCard` / 扩展 `ExplainCard`）不传分类 |
| 文档 | `docs/product/notebook.md`、`docs/tech/database.md`、`docs/tech/phase-5-notebook-multi-user.md` |

## 约束

- 须兼容游客笔记（localStorage）与登录云端；迁移路径 `migrate-guest` 若本期带 tags，须幂等且不破坏旧数据。
- RLS / `user_id` 隔离不变；分类不得跨用户可见。
- 与「重复检测」「搜索」并存：分类筛选是**正交**维度，不替代 `q=` 全文搜索。

## 关键决策（待用户确认）

| 选项 | 说明 | 推荐默认 |
|------|------|----------|
| **A. 复用 `tags` 作分类** | MVP：每条笔记 0～1 个主分类（`tags[0]`），列表页 chip 筛选；多标签二期 | **推荐**（零迁移成本） |
| **B. 新建 `categories` 表** | 用户自定义分类名 + `note_categories` 多对多 | 分类体系变复杂时再上 |
| **C. 固定枚举分类** | 产品写死若干类（如「概念 / 工具 / 待办」） | 迭代快但难扩展 |

**保存时何时选分类**：保存弹层可选 / 默认「未分类」后在笔记本改 —— **推荐默认「未分类」+ 笔记本页可改**。

## 依赖与风险

- **依赖**：笔记本列表与 `lib/db/notes.ts` / `app/api/notes`；扩展保存若要带分类则依赖扩展 UI（可二期）。
- **风险**：仅 Web 改分类、扩展仍写入空 tags 会造成「插件笔记全进未分类」——MVP 可接受，须在文案写明。
- **回滚**：UI/API 读 `tags` 失败时降级为「全量列表」；DB 列已存在，无破坏性 migration 时回滚成本低。

## 文档索引

- 方案：[`笔记分类-plan.md`](./笔记分类-plan.md)
- 任务：[`笔记分类-tasks.md`](./笔记分类-tasks.md)
