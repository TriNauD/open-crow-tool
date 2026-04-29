# 分环境：开发 / Preview / 生产（约定）

本文档记录 **Vercel、Supabase、Chrome 扩展** 联测时的分环境做法与常见坑，与 `.cursor/rules/env-and-secrets.mdc` 一并作为团队规范。

---

## 1. 环境怎么切

| 层级 | 开发（本地） | Preview（PR / 分支部署） | Production（`main`→生产） |
|------|--------------|---------------------------|----------------------------|
| **Next 部署** | `npm run dev` | `*.vercel.app` | 自定义域（如 `www.crowknows.tech`） |
| **Supabase** | 建议使用 **独立 Staging 项目**（与生产库隔离） | 同左：Preview 环境变量指向 **Staging** | **Production** Supabase 项目 |
| **密钥** | `.env.local`（不入库） | **Vercel → 勾选 Preview** 单独配置 | **Vercel → Production** |

原则：**Preview 与 Production 的环境变量「同名、不同值」**，不要混用同一套生产密钥做破坏性测试。

---

## 2. Vercel 环境变量（必查）

1. **每项变量**在创建时勾选适用的 **Environment**：`Development` / `Preview` / `Production`。  
2. **`NEXT_PUBLIC_*`** 的值在 **build 阶段**写入前端包；修改后必须 **Redeploy** 对应 Deployment 才会生效。  
3. **禁止**把两条变量粘进同一个 Value，例如把整个  
   `NEXT_PUBLIC_SUPABASE_URL=...NEXT_PUBLIC_SUPABASE_ANON_KEY=...`  
   写进 **`NEXT_PUBLIC_SUPABASE_URL`** 一项 —— 会导致请求 URL 畸形（如 `.supabase.con...eyJ...`）、`Failed to fetch` / `net::ERR_UNEXPECTED`。

正确分拆示例：

```text
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...（仅 JWT 字符串）
```

4. **`AI_PROVIDER` / `AI_API_KEY`** 等：若在本地能调用 `/api/explain`，Preview 也需为 **Preview 环境**配上相同前缀变量，否则会 500 或无流。

自检：本地可 `vercel env pull .env.check --environment=preview`（需已登录 CLI）核对拉下来的值是否与 Dashboard 一致。

---

## 3. Vercel Deployment Protection（部署保护）

开启 **Vercel 身份验证 / 标准保护** 时：**除生产以外的部署**（典型为 `*.vercel.app`）会要求 **访客已登录 Vercel 且为团队成员**。

影响：

- 无痕或外部用户打开 Preview → 先被拦去登录 Vercel。  
- **Chrome 扩展**在第三方网页上 `POST https://xxx.vercel.app/api/explain` **不会**携带 Vercel 登录 Cookie → 易出现 **401**，划词报「网炸了或者 AI 挂了」（实为 `fetch` 失败）。

建议：

- **要测「扩展 + Preview」**：在可接受风险的前提下，对 Preview **关闭或放宽** Deployment Protection；或  
- **不测受保护 Preview**：扩展联调用 **`http://localhost:3000`**（注意混合内容）或 **`https://` 的生产站**。

混合内容：**HTTPS** 网页上 **禁止**请求 **`http://localhost`**；测本地时请用 HTTP 页面、HTTPS 本地（如 mkcert）、或连 **HTTPS Preview/生产**。

---

## 4. Supabase

- **测试库与生产库**：推荐 **两个 Supabase Project**（不同 `*.supabase.co` ref）；Staging **需执行与生产一致的 DDL**：见 `docs/tech/database.md` 与 `db/migrations/*.sql`（按日期顺序）。  
- **Auth → URL Configuration**：Site URL、Redirect URLs 与当前环境域名一致；生产不要用 `localhost` 作为唯一 Site URL。  
- **注册邮件 `redirect_to`**：应用侧已传 `emailRedirectTo`（见 `lib/auth/email-confirm-redirect.ts`）；控制台仍应配置正确白名单。

---

## 5. Chrome 扩展

- **`apiBaseUrl` + `accessToken`** 来自网站「连接插件」；须与当前测的环境一致。  
- **换环境**：从 Vercel Preview 换到生产域名（或相反）时，须在 **对应环境的网站** 上 **重新点「连接插件」**，扩展里的 `apiBaseUrl`/token 才会与目标一致。
- Options 里「打开网站」的 fallback 默认 **`https://dev.crowknows.tech`**（团队 Preview）；若与当前环境不符可改扩展源码常量或仍以 **已连接成功** 时显示的 `apiBaseUrl` 为准。  
- **CORS**：`/api/explain`、`/api/notes` 已带 `OPTIONS` 与跨域头；若仍失败，先排除 **401（部署保护）** 与 **环境变量错误**。

---

## 6. 发布与 CI

- 根目录 `npm run verify`：**不**包含 Playwright E2E；与 GitHub Actions 完整对齐见 `npm run verify:e2e` 或 CI 工作流。  
- `npm run lint` 已显式包含 `chrome-extension/src` 与 `e2e`，避免扩展未进 ESLint 范围。

---

## 7. 变更记录

| 日期 | 说明 |
|------|------|
| 2026-04-29 | Options「打开网站」fallback 默认 `https://dev.crowknows.tech`（团队 Preview）。 |
| 2026-04-29 | Chrome 扩展：换 Preview/生产域名需在该环境网站重新「连接插件」。 |
| 2026-04-28 | 首版：Vercel 分环境、Deployment Protection、Supabase 双项目、扩展联调、混合内容、Env 勿合并为一项。 |
