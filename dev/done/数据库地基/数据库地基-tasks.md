# 数据库地基 — 任务清单

## 进度

- [x] 建立 dev 需求文档
- [x] npm install @supabase/supabase-js
- [x] 创建 lib/db.ts
- [x] 创建 lib/auth.ts
- [x] 改造 lib/storage.ts（async + Supabase）
- [x] 创建 app/actions.ts（Server Actions）
- [x] 创建 app/api/notes/route.ts（GET + POST）
- [x] 创建 app/api/notes/[id]/route.ts（DELETE）
- [x] 改造 components/ExplanationCard.tsx（handleSave async）
- [x] 改造 app/notebook/page.tsx（server actions）
- [x] 更新 .env.local.example
- [x] 本地测试通过
- [x] PM 审核
- [x] 用户验收 ✅ 2026-04-24

## 验收标准
1. 保存一条笔记 → Supabase Table Editor 里能看到
2. 删除笔记 → Supabase 里消失
3. 搜索正常
4. 无痕窗口打开 → 笔记本数据依然存在（不依赖 localStorage）
5. 移除 x-admin-secret header 调 /api/notes → 返回 401
