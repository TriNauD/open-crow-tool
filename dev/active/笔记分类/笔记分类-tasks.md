# 笔记分类 — Tasks

> 开工前：`git checkout dev && git pull` → `git checkout -b fea/note-categories-tri`  
> **编码门禁**：用户明确批准本方案（阶段 2）后再动业务代码。  
> 结项：补 `笔记分类-qa.md` + acceptance → 迁 `dev/done/`、补 log。

## 阶段 0：定稿

- [ ] PM：确认分类模型（A 复用 tags / B 新表 / C 固定枚举）与「未分类」文案
- [ ] PM：确认扩展保存是否本期带分类（默认：否）
- [ ] TL：确认筛选走 `?tag=` 还是仅客户端（默认：笔记量小可先客户端，预留 query）

## 阶段 1：数据与 API

- [ ] `lib/db/notes.ts`：读写 `tags`；保存/列表映射正确
- [ ] `POST /api/notes`：接受并校验 `tags`
- [ ] `PATCH /api/notes/[id]`（或等价）：更新分类
- [ ] `GET /api/notes`：可选按 tag 过滤（若定稿需要）
- [ ] Guest：`lib/guest-notes.ts` + migrate 带 `tags`
- [ ] `lib/api/notes-client.ts` 封装同步

## 阶段 2：UI

- [ ] 笔记本页：分类 chip（全部 / 未分类 / 已有类）
- [ ] 笔记卡片：展示分类 + 修改入口
- [ ] （可选）Web 保存流带默认空 tags

## 阶段 3：验证与文档

- [ ] 手测：登录 / 游客 / 旧数据无 tags / 搜索+筛选叠加
- [ ] `npm run lint`、相关 `npm run test`
- [ ] 更新 `docs/product/notebook.md` 一句
- [ ] 编写 `笔记分类-qa.md`（及 preview acceptance）
