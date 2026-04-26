# Phase 4：外部订阅接入 — 上下文

## 背景

Phase 3 完成后，有外部用户表示想订阅周报。原来 `DIGEST_TO_EMAIL` 只发给一个固定邮箱，无法接受外部订阅。Phase 4 的最小目标是打通订阅闭环。

## 技术决策

- **不引入 Stripe**：付费是 Phase 5 的事，本阶段只做免费订阅接入
- **status 直接 active**：无需邮件确认（double opt-in），保持最简
- **退订 URL 动态构建**：cron 用 `new URL(req.url).origin` 拿 baseUrl，无需新增环境变量
- **Next.js 16 searchParams**：server component 中 searchParams 是 Promise，需 await
- **unsubscribe_token**：Supabase 自动生成 UUID，无需应用层生成

## 关键约束

- `lib/db/subscribers.ts` 只在服务端运行（Route Handler / Server Action 内调用）
- 邮件 footer 的退订链接格式：`{baseUrl}/api/unsubscribe?token={unsubscribe_token}`
- DIGEST_TO_EMAIL 发送时不带退订链接（管理员地址）

## 与现有架构的关系

- 复用 `lib/db/client.ts`（Supabase 单例）
- 复用 `lib/email.ts`（扩展签名，向后兼容）
- 与 Phase 1 笔记本数据库在同一个 Supabase 项目，不同的表
