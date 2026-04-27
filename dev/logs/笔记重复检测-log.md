# 笔记重复检测 日志

## 2026-04-27（结项 / tri）
- 用户验收通过：对比弹窗、都保留/覆盖、游客与登录、追问跳过、布局响应式
- 云端重复检测保持轻量：仍用 `fetchNotes(accessToken, inputText.trim())` 走带 `q` 的搜索，**不**在客户端拉全量笔记；极端同题变体与 `ilike` 错位时可能漏检，记为技术债，后续再改
- 文档收尾：`dev/done/笔记重复检测/` 归档 plan/context/tasks/qa，本 `log` 记录问题与关键取舍

## 遗留问题（不阻塞）
- 上条「ilike 候选 + 本地标准化」的边界，见 `笔记重复检测-qa.md` §6
- `replaceNote` 非原子：DELETE 后 POST 失败时旧已删、新可能未落库（已有 context 说明，可接受）
