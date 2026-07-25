# 笔记分类 — Plan

> **分支建议**（编码时再切）：`fea/note-categories-tri`  
> **池条目**：B-1

## 目标

1. 用户能为笔记指定**分类**（MVP：单主分类，可「未分类」）。
2. 笔记本页可按分类**筛选**，与现有搜索叠加。
3. 登录态分类落库（`tags`）；游客态落 localStorage，登录迁移不丢。

## 非目标（本期）

- 多级文件夹、拖拽排序、共享分类、AI 自动打标。
- 扩展划词保存时必选分类（可选二期；MVP 扩展可写空 tags）。

---

## [PM] 功能与验收口径

### 用户故事

- 作为重度用户，我希望在笔记本把笔记归到「RAG / 工具 / 杂项」等类，快速缩小列表。
- 作为游客，分类应存在本地，登录后尽量保留。

### 验收要点（草案）

- 笔记本页可见分类 chip（含「全部」「未分类」）+ 筛选结果正确。
- 可为笔记设置/修改分类并刷新后仍在。
- 搜索 `q=` 与分类筛选可同时生效（交集）。
- 无分类数据的旧笔记视为「未分类」，不报错。

---

## [TL] 技术方案

### 数据

- **推荐**：复用 `notes.tags text[]`；约定 MVP **`tags[0]` = 主分类名**（trim，长度上限如 32；大小写展示保留、筛选可规范化）。
- `lib/db/notes.ts`：`NoteEntry.tags` 读写贯通；`saveNote` / `getNotes` select 含 `tags`。
- 可选轻量：`GET /api/notes?tag=` 或客户端拉全量后筛（笔记量小时可先客户端筛，量上来再加服务端 filter）。

### API

| 改动 | 说明 |
|------|------|
| `POST /api/notes` | Body 增可选 `tags?: string[]`（校验长度/条数） |
| `PATCH` 或 `PUT`（若尚无） | 仅改分类：优先 **新增** `PATCH /api/notes/[id]` 改 `tags`，避免整条重写 |
| `GET /api/notes` | 可选 `?tag=`；无则行为与现网一致 |
| `migrate-guest` | Guest 条目带 `tags` 时写入 |

### UI

| 区域 | 说明 |
|------|------|
| `app/notebook/page.tsx` | 分类 chip 栏；卡片展示分类；「编辑分类」入口 |
| `lib/guest-notes.ts` | Guest 结构增加 `tags?` |
| 保存流（可选） | `ExplanationCard` 保存时可带默认空 tags |

### 涉及文件（预估）

- `lib/db/notes.ts`、`app/api/notes/route.ts`、`app/api/notes/[id]/route.ts`（PATCH）
- `lib/api/notes-client.ts`、`lib/guest-notes.ts`
- `app/notebook/page.tsx`
- `docs/product/notebook.md`（定稿时改「tags 暂不做 UI」）
- 单测：`__tests__/` 下 notes 相关（若有则扩；无则补契约测）

### 风险与回滚

- **风险**：分类名自由文本导致碎片化 → MVP 可提供「最近用过的分类」快捷选择。
- **回滚**：隐藏 chip UI；忽略 `tags` 读写即可（列可保留）。

---

## [QA] 影响域备忘

- 笔记本列表 / 搜索 / 删除 / 游客迁移 / 重复检测保存路径（勿破坏）。
- 回归：保存笔记、覆盖重复、扩展 `source=chrome_extension` 列表徽章。

## [Decision]

- 默认按 **方案 A（复用 tags）** 写 tasks；若用户选 B/C，在 tasks「阶段 0」改勾后编码。
