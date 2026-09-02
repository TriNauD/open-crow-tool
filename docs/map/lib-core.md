# 共享业务逻辑（`lib/`）与数据模型（`db/migrations/`）

## AI（`lib/ai/`）

| 文件 | 职责 |
|---|---|
| `lib/ai/providers.ts` | **provider 链**：多厂商路由与免费回退阶梯（siliconflow，单日 ¥2 预算）、用户自配 LLM 头 `x-crow-llm-config` 编解码与校验、`x-crow-provider`、成本估算 `MODEL_PRICING_CNY_PER_M` |
| `lib/ai/prompts.ts` | 解释 prompt 模板：大白话风格、划词上下文（B-2 `surroundingText`）、名词消歧规则（C-1 `DISAMBIGUATION_RULES`） |
| `lib/ai/image-limits.ts` | 截图上传限制（mime 白名单 / 尺寸），配合 vision 多模态 |

## 数据访问（`lib/db/` + `db/migrations/`）

| 文件 | 职责 |
|---|---|
| `lib/db/client.ts` | 服务端 Supabase 单例（service role；env 缺失启动即 throw） |
| `lib/db/notes.ts` | notes 表 CRUD + `NoteEntry` 类型 |
| `lib/db/subscribers.ts` | subscribers 表访问（周报订阅） |
| `db/migrations/20260426_notebook_multi_user.sql` | 多用户笔记本 DDL：notes 表 + RLS 策略 |

## 横切设施（`lib/` 根与子目录）

| 文件 | 职责 |
|---|---|
| `lib/utils/cors.ts` | **CORS 统一头**：`*` origin；预检头含 Authorization / x-crow-llm-config；Expose `x-crow-provider` |
| `lib/utils/auth.ts` | Bearer → `getRequestUser`（扩展 / 网页共用鉴权通道） |
| `lib/request-guard.ts` | 按 IP 固定窗口限流（Upstash 可选、内存 fail-open 兜底）+ Origin 校验 |
| `lib/url/fetch-safe.ts` | **SSRF 防护**：DNS 解析校验私网、超时 5s（`FETCH_TIMEOUT_MS`）、512KB、3 跳重定向、12k 字符截断 |
| `lib/user-llm-config.ts` | 用户自配 LLM 的 localStorage 存储与请求头编码（扩展版是平行实现） |
| `lib/email.ts` | 邮件发送：Resend 优先、SMTP（Gmail / Outlook）兜底；周报模板与分级（夯 / 顶级 / 人上人 / NPC / 拉完了）、运维通知 |
| `lib/github-trending.ts` | cheerio 抓 GitHub Trending（周报数据源） |
| `lib/guest-notes.ts` | 游客笔记 localStorage（`crow_guest_notes_v1`）读写与清理 |
| `lib/api/notes-client.ts` | 笔记 API 客户端封装（Bearer 头、统一错误解析） |
| `lib/supabase/browser.ts` | 浏览器端 Supabase 单例（anon key） |
| `lib/auth/email-confirm-redirect.ts` | 注册确认邮件回跳 URL（`EMAIL_CONFIRM_LANDING_PATH=/notebook`） |
| `lib/client/compress-image.ts` | 截图客户端压缩（1280 边长 / JPEG 0.82） |
| `lib/notes/normalize-input.ts` | 查重规范化：trim + lower + 折叠空白 |
| `lib/notes/tags.ts` | 分类校验 / 规范化（MVP 单分类 tags[0]，≤32 字） |
| `lib/config/notebook.ts` | 多用户开关 `NOTEBOOK_MULTI_USER_ENABLED`（紧急回滚） |
| `lib/observability/notebook.ts` | 结构化日志指标（scope=notebook_multi_user） |
| `lib/keyboard-send-hint.ts` | 发送 / 换行快捷键角标文案 + 手机 UA 判定 |
| `lib/utils/cn.ts` | className 合并工具 |
| `lib/utils/same-page-origin.ts` | postMessage 同源校验（localhost / 127.0.0.1 / ::1 视为同一开发源） |

## 坑

- `lib/db/client.ts` 是 **service role（绕过 RLS）**：只能在 API 路由服务端用；客户端一律走 `lib/supabase/browser.ts`。
- 头常量 `x-crow-llm-config` / `x-crow-provider` 在 `lib/ai/providers.ts`、`lib/user-llm-config.ts`、`chrome-extension/src/lib/user-llm-config.ts` 三处重复；改名必须全同步，且 `lib/utils/cors.ts` 预检白名单也要加。
- 抓取上限常量集中在 `lib/url/fetch-safe.ts`，路由里不要再写死一份。

## 相关测试

- `__tests__/providers-user-config.test.ts`、`__tests__/explain-prompt.test.ts`、`__tests__/prompts-disambiguation.test.ts`、`__tests__/image-limits.test.ts`、`__tests__/fetch-safe-ssrf.test.ts`、`__tests__/request-guard.test.ts`、`__tests__/cors.test.ts`、`__tests__/same-page-origin.test.ts`、`__tests__/normalize-note-input.test.ts`、`__tests__/note-tags.test.ts`、`__tests__/keyboard-send-hint.test.ts`
