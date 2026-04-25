# Phase 3 周报邮件 — 上下文

> 创建：2026-04-25

---

## 项目背景

- Phase 1（云端笔记本）、Phase 2（Chrome 划词插件）均已验收通过
- 现有技术栈：Next.js 16 App Router + Tailwind v4 + Supabase + Vercel
- 已有 AI 多厂商封装：`lib/ai-providers.ts`，Phase 3 直接复用
- `resend` 包已在 `package.json` 中，无需重新安装
- `cheerio` 尚未安装，需 `npm install cheerio`

## 需求变更记录

| 版本 | 日期 | 变更内容 |
|---|---|---|
| v1.0 | 2026-04-24 | 初版：爬取 Top 20，AI 生成 1-2 句总结，发邮件 |
| v1.1 | 2026-04-25 | 升级：一句话摘要 + "有点意思，给我也整一个！"CTA；新增五档排名（夯/顶级/人上人/NPC/拉完了）；双维度打分（技术创新性+场景创新性）；全部档位保留在邮件中；邮件标题风格初稿确认 |

## 关键约束

- Cron Route 用 `GET`（Vercel Cron 规范）
- 鉴权：`CRON_SECRET`（Vercel 自动注入到 `Authorization: Bearer` header）
- AI 调用：一次 batch，不能拆 20 次（成本控制）
- 邮件 HTML 模板内联样式（邮件客户端不支持外部 CSS）
- `SUPABASE_SERVICE_ROLE_KEY` 和 `ADMIN_SECRET` 不能泄漏到客户端

## 参考文件

- `docs/PRD.md` § 二-模块C（已更新至 v1.1）
- `docs/PLAN.md` § 六（已更新至 v1.1）
- `docs/CHECKLIST.md` § Phase 3（待开发前核对）
- `lib/ai-providers.ts`：AI 调用入口，Phase 3 直接用
- `app/api/explain/route.ts`：参考 streaming 调用写法（Phase 3 不需要 stream）
