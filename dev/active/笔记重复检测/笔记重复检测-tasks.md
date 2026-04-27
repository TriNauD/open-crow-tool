# 笔记重复检测 Tasks

## 开发任务
- [x] 新增 `components/DuplicateNoteModal.tsx`：对比弹窗，响应式
- [x] 改造 `components/ExplanationCard.tsx`：保存前检测重复
- [x] 新增 `lib/api/notes-client.ts` `replaceNote` 方法
- [x] 更新 `docs/PRD.md` 和 `docs/PLAN.md`

## 验收标准
- [ ] 已登录：问同一个词两次，第二次存入时弹出对比弹窗
- [ ] 游客态：同上，对比 localStorage 中旧笔记
- [ ] 追问笔记（划词继续问）不触发重复检测
- [ ] 点"都保留"：笔记本出现两条
- [ ] 点"覆盖旧的"：笔记本只有一条（新的）
- [ ] 移动端上下排列，桌面左右并排
