# Web API（`app/api/`）

后端全部在此，Next.js App Router route handler。注意：本仓库 Next 版本与训练数据可能不同，动手前先读根目录 AGENTS.md 的警告与 `node_modules/next/dist/docs/`。

## 通用约定

- 每个路由都导出 `OPTIONS` 返回 204 + CORS 头（`lib/utils/cors.ts`）；新增请求头要同步 `Access-Control-Allow-Headers`。
- 鉴权：`lib/utils/auth.ts` 的 `getRequestUser(req)` 解 Bearer JWT（notes 系列路由使用；explain 公开、周报走 cron 调度）。
- 限流/Origin 校验工具：`lib/request-guard.ts`（Upstash 可选，内存兜底 fail-open），目前 `app/api/explain/route.ts` 与 `app/api/fetch-url/route.ts` 在用。
- 错误响应统一 `{ error: string }` JSON；explain 兜底为纯文本 `AI 炸了：…`。

## 路由清单

| 路由文件 | 方法 | 职责 | 要点 |
|---|---|---|---|
| `app/api/explain/route.ts` | POST | **核心**：大白话流式解释（`text/plain` ReadableStream 分块，非 SSE） | provider 链与免费回退阶梯（预算结算 `budgetSettle`）；用户自配 LLM 经 `x-crow-llm-config` 头透传（base64url JSON）；`x-crow-provider` 回告实际生效方；免费预算用尽降级时带 `x-crow-quota-out: 1`；prompt 在 `lib/ai/prompts.ts` |
| `app/api/notes/route.ts` | GET / POST | 笔记列表 / 保存 | Bearer 鉴权；tags 走 `lib/notes/tags.ts`（MVP 单分类 tags[0]） |
| `app/api/notes/[id]/route.ts` | PATCH / DELETE | 单笔记改 / 删 | PATCH 支持改分类（B-1） |
| `app/api/notes/migrate-guest/route.ts` | POST | 游客笔记上云迁移 | 接收 localStorage 游客笔记（`lib/guest-notes.ts`）批量写入账号 |
| `app/api/fetch-url/route.ts` | POST | 抓取 URL 正文（链接内容 D-1） | SSRF 防护在 `lib/url/fetch-safe.ts`（5s / 512KB / 3 跳 / 12k 字符）；按 IP 每小时限流（默认 20，env `RATE_LIMIT_FETCH_URL_PER_HOUR`） |
| `app/api/subscribe/route.ts` | POST | 邮件订阅 | 路由内自带内存限流（3 次 / 60s） |
| `app/api/unsubscribe/route.ts` | GET | 退订（邮件里的 token 链接） | 重定向回 `app/unsubscribe/page.tsx?status=…` 结果页 |
| `app/api/cron/weekly-digest/route.ts` | GET（cron） | **周报**：汇总上周笔记 + GitHub Trending 分级邮件 | 触发配置在 `vercel.json`（周一 9:00）；运维通知 env `DIGEST_OPS_NOTIFY_EMAILS`；数据访问 `lib/db/notes.ts`、发信 `lib/email.ts`、抓取 `lib/github-trending.ts` |
| `app/api/feishu/events/route.ts` | POST / OPTIONS | 飞书事件订阅占位（D-2） | 有意 501 不接通；选型文档见 dev/active/飞书等平台 |

## 已知坑

- `app/api/subscribe/route.ts` 与 `app/api/fetch-url/route.ts` 的部分限流是**进程内存 Map**，Vercel serverless 多实例不共享——精确限流需配 Upstash（`lib/request-guard.ts` 已支持）。
- explain 流的结束以**流关闭**为准，客户端 hook 读完全部分块才置完成态；f4146e8 修过「空流被误报网络炸了」——动结束路径前先看该提交。
- 周报分级（夯 / 顶级 / 人上人 / NPC / 拉完了）与邮件模板都在 `lib/email.ts`。
- `app/api/feishu/events/route.ts` 改动前先读其头注释与 evaluation 文档，别顺手「接通」。

## 相关测试 / E2E

- 单测：`__tests__/feishu-stub.test.ts`、`__tests__/fetch-safe-ssrf.test.ts`、`__tests__/request-guard.test.ts`、`__tests__/providers-user-config.test.ts`、`__tests__/explain-prompt.test.ts`、`__tests__/cors.test.ts`
- E2E：`e2e/`（首页 / 注册 / 扩展桥）
