# 笔记本

> 原 PRD「三、笔记本功能详细需求」

笔记本是贯穿 Web / 扩展的核心数据沉淀。

**数据结构：**

| 字段 | 说明 |
|---|---|
| `id` | UUID |
| `user_id` | 真实 Supabase 用户 ID，由 RLS 强制隔离（Phase 5 ✅） |
| `client_note_id` | 客户端本地生成的幂等标识，用于游客笔记迁移去重（Phase 5 ✅） |
| `input_text` | 用户的问题/输入 |
| `explanation` | AI 解释内容 |
| `parent_id` | 追问时关联的父条目 |
| `parent_text` | 父条目的原始文本（展示上下文用） |
| `source` | 来源：`web` / `chrome_extension` |
| `saved_at` | 时间戳 |
| `tags` | MVP：**主分类**落在 `tags[0]`（空=`未分类`）；笔记本页 chip 筛选与编辑，见 [`dev/active/笔记分类/`](../../dev/active/笔记分类/) |

**Web 端笔记本页面：**
- 列表展示，默认折叠，点击展开
- 搜索（按 input_text 和 explanation 全文搜索；**2026-08-31 起为前端本地过滤**——页面本就全量拉取，关键词即时生效且对逗号/`%` 等特殊字符安全；后端 `GET /api/notes?q=` 保留供存笔记查重候选，已改为两条 ilike + 内存合并，不再拼接 PostgREST or 语法）
- 分类 chip（全部 / 未分类 / 已有类）与搜索可叠加；展开后可编辑分类
- 删除
- 显示来源（Web / 插件，用小标签区分）

**重复检测（Phase 5.1 ✅）：**
- 保存顶层笔记时，自动检测是否已有相同 `inputText` 的笔记（标准化：trim + toLowerCase + 折叠空白，"RAG 是啥" = "rag是啥"）
- 命中时弹出新旧答案对比弹窗（桌面左右并排，移动端上下叠放）
- 用户可选择"都保留"或"覆盖旧的"
- 追问笔记（有 parentId）跳过检测，允许重复
- 登录态查云端，游客态查 localStorage
- **扩展侧（已合 `fea/future-features`）**：保存对齐同一规则 — [`dev/active/划词保存重复笔记校验/`](../../dev/active/划词保存重复笔记校验/)；本批接手见 [FUTURE-FEATURES-HANDOFF](../../dev/active/BRAINSTORM需求池/FUTURE-FEATURES-HANDOFF.md)
