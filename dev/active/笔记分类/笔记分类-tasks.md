# 笔记分类 — Tasks

> 分支：`fea/note-categories-wesrindo` → merge `fea/future-features`  
> 手测：[`笔记分类-manual-test.md`](./笔记分类-manual-test.md)

## 阶段 0：定稿

- [x] PM：确认分类模型（A 复用 tags）与「未分类」文案
- [x] PM：扩展保存本期不带分类
- [x] TL：筛选先客户端（搜索仍走 `?q=`）

## 阶段 1：数据与 API

- [x] `lib/db/notes.ts`：读写 `tags`；`updateNoteTags`
- [x] `POST /api/notes`：接受并校验 `tags`
- [x] `PATCH /api/notes/[id]`：更新分类
- [x] Guest：`lib/guest-notes.ts` + migrate 带 `tags`
- [x] `lib/api/notes-client.ts`：`patchNoteTags` / create 可选 tags
- [x] `lib/notes/tags.ts` 校验与筛选辅助

## 阶段 2：UI

- [x] 笔记本页：分类 chip（全部 / 未分类 / 已有类）
- [x] 笔记卡片：展示分类 + 修改入口（含最近分类快捷）

## 阶段 3：验证与文档

- [x] `__tests__/note-tags.test.ts`
- [x] `npm run lint` / `npm run test`（合入前跑）
- [x] 更新 `docs/product/notebook.md` 一句
- [x] 保姆级手测 [`笔记分类-manual-test.md`](./笔记分类-manual-test.md)
- [ ] 用户手测 PASS 后补 qa / 结项（合 `dev` 时再做）
