# 笔记重复检测 Plan

## 目标
存笔记前检测是否已有相同问题，展示新旧答案对比，由用户决定覆盖或都保留。

## 匹配规则
- `inputText.trim().toLowerCase().replace(/\s+/g, '')` 折叠空白后精确匹配
- 即 "RAG 是啥" = "rag是啥" = "RAG是啥"
- 追问笔记（`parentId` 不为空）跳过检测
- 登录态：查后端；游客态：查 localStorage

## 变更范围

| 文件 | 改动 |
|---|---|
| `components/DuplicateNoteModal.tsx` | 新增，对比弹窗，响应式布局 |
| `components/ExplanationCard.tsx` | 修改，保存前做重复检测，命中则弹窗 |
| `lib/api/notes-client.ts` | 新增 `replaceNote` 方法 |

后端不需要改动。

## 布局规则
- 桌面（≥ md）：左右并排，各 50%
- 移动端（< md）：上下叠放，旧在上新在下

## 操作语义
- **都保留**：直接 POST 新笔记
- **覆盖旧的**：DELETE 旧笔记 → POST 新笔记
