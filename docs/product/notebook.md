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
| `tags` | 标签数组（预留，暂不做 UI） |

**Web 端笔记本页面：**
- 列表展示，默认折叠，点击展开
- 搜索（按 input_text 和 explanation 全文搜索）
- 删除
- 显示来源（Web / 插件，用小标签区分）

**重复检测（Phase 5.1 ✅）：**
- 保存顶层笔记时，自动检测是否已有相同 `inputText` 的笔记（标准化：trim + toLowerCase + 折叠空白，"RAG 是啥" = "rag是啥"）
- 命中时弹出新旧答案对比弹窗（桌面左右并排，移动端上下叠放）
- 用户可选择"都保留"或"覆盖旧的"
- 追问笔记（有 parentId）跳过检测，允许重复
- 登录态查云端，游客态查 localStorage
