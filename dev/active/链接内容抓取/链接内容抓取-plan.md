# 链接内容抓取 — Plan

> **分支建议**：`fea/url-content-fetch-tri`  
> **池条目**：D-1（单独立项）

## 目标

1. 用户确认后，服务端安全抓取 URL 正文摘要，再交给 `/api/explain` 解释。
2. 具备 SSRF 防护、超时、体积上限与失败降级。
3. Web MVP；扩展可复用同一 fetch API（二期）。

## 非目标

- 通用爬虫平台、登录态抓取、PDF/完整站点镜像、搜索引擎索引。

---

## [PM] 验收要点（草案）

- 粘贴公开博客 URL → 点「读取链接」→ 解释引用正文要点（抽样）。
- `http://127.0.0.1` / 内网 IP / 非 http(s) → **拒绝**，不发起危险请求。
- 超时或 404 → 降级提示，不 500 整页崩溃。

---

## [TL] 技术方案

### 新 API（草案）

`POST /api/fetch-url`（需否登录：阶段 0 定；**推荐需登录或与 explain 同级限流**）

```json
{ "url": "https://example.com/a" }
→ { "data": { "title": "...", "text": "...", "truncated": true } }
// 或 4xx { error, code: "SSRF_BLOCKED" | "TIMEOUT" | ... }
```

### SSRF 清单（最低）

1. 仅 `http:` / `https:`  
2. 禁止 credentials 在 URL 内  
3. DNS resolve → 拒绝 private/link-local/metadata  
4. 禁止 follow redirect 到非法 IP（每跳重验）  
5. Timeout（如 5s）、max bytes（如 512KB）、最多 redirect 3  
6. Content-Type 允许 text/html、text/plain 等  

### 与 explain 衔接

- 客户端：`pageText` 或拼进 `text`：`用户链接：URL\n\n正文摘要：…\n\n请解释…`  
- 或扩展 `buildExplainPrompt` 增加 `fetchedContent?` 槽位（更干净）。

### 涉及文件（预估）

- 新：`lib/url/fetch-safe.ts`、`app/api/fetch-url/route.ts`
- `app/page.tsx`（检测 URL + 按钮）
- `lib/ai/prompts.ts`（可选）
- 单测：SSRF 用例表（大量）
- `docs/tech/` 安全说明一句；`docs/product/web-explainer.md`

### 风险与回滚

- 回滚：下线按钮与路由即可；无 DB。
- 依赖新增须单独 PR（遵守 dependency 规则）。

---

## [QA] 影响域

- 安全回归（SSRF 用例必测）、explain 主路径、限流。

## [Decision]

- **独立 fetch API + 用户确认触发 + 严格 SSRF**；正文抽取 MVP 从简。
