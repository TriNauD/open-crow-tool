# 解释接口成本护栏 — Bug 记录

`/api/explain` 公开烧钱接口的防滥用加固。主题独立成档；后续同接口的迭代可追加。

### BF-1：/api/explain 完全公开无限流无输入上限，付费 key 可被任意消耗（2026-08-31）

- **现象**：`POST /api/explain` 无需登录即可调用，正文 `text` 无长度上限、无按 IP 限流；任何人 POST 文本就消耗 SiliconFlow/NVIDIA 付费 key（图片约 1.2MB 与 `surroundingText` 400 字符有上限，正文反而没有；`max_tokens: 400` 只管输出不管输入）。复现：`curl -X POST .../api/explain -d '{"text":"超长文本..."}'` 直接出流式解释。
- **根因**：接口设计初期为个人工具未设防；`/api/subscribe` 有内存限流而 explain 漏配；serverless 内存 Map 跨实例失效，需共享存储才能真限流。
- **涉及文件**：`lib/request-guard.ts`（新增：Upstash Redis 优先 + 内存兜底 fail-open 的固定窗口限流、`getClientIp`、Origin 纵深防御）、`app/api/explain/route.ts`（三道护栏：403 Origin / 429 Retry-After 默认 60 次/h/IP / 413 正文 > 12000 字符，`context` 截断 2000）、`.env.local.example`（`UPSTASH_REDIS_REST_*`、`RATE_LIMIT_EXPLAIN_PER_HOUR`）。
- **验证**：`npm run test` 25 passed（含 `__tests__/request-guard.test.ts` 10 用例）；curl 手测 413（超长）/ 403（第三方 Origin）/ 正常流式返回不受影响；`npm run lint` 0、`npm run build` 通过。生产生效需在 Vercel 配 `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`（未配则退内存兜底）。
- **分支 / PR**：`bugfix/explain-cost-guard` → [#32](https://github.com/TriNauD/open-crow-tool/pull/32)
- **备注**：`/api/fetch-url`（仅存在于 `fea/future-features` 管道）已加同款护栏（`fea/fetch-url-cost-guard`，限流 20 次/h/IP + URL ≤ 2048）；个人自用场景 60 次/h 充裕，误触 429 可调环境变量放宽。

### BF-2：BF-1 的 Origin 护栏挡住扩展划词解释（2026-08-31）

- **现象**：#32 部署 dev 后，扩展划词卡片解释全部 403「Origin 不被允许」。实测：`curl -H "Origin: https://news.ycombinator.com" -X POST …/api/explain` → 403；`Origin: chrome-extension://…` → 200；无 Origin → 200。
- **根因**：MV3 content script 在第三方页面发起的 fetch，浏览器带的 Origin 是**网页** origin 而非 `chrome-extension://`，被 `isOriginAllowed` 的第三方拒绝分支命中。BYOK 头（`x-crow-llm-config`）同样无法送达。
- **涉及文件**：`chrome-extension/src/content/useStreamExplain.ts`（解释请求改经 `chrome.runtime.connect('crow-explain-proxy')` Port 发往 background；`chrome.runtime` 不可用时明确提示而非静默）、`chrome-extension/src/background/index.ts`（SW 收 Port 消息后代发 `/api/explain` 并流式回传 chunk / done / error，20s ping 保活，透传 BYOK 头）、`chrome-extension/manifest.json` 0.1.28。
- **验证**：`npm run lint` 0 warning；扩展 build 通过；`e2e/extension-crow-bridge.spec.ts` 5/5；dev 站 curl 复测 `chrome-extension://` Origin 200。扩展端需重载 dist 后在第三方页面手测划词解释。
- **分支**：`bugfix/ext-explain-via-sw-wesrindo` → 合入 `fea/future-features` 随整包 PR 进 dev。
- **备注**：SW 发起的 fetch Origin 为 `chrome-extension://`，属护栏明确放行分支，未放宽任何护栏条件；BYOK 头经 SW 透传，自配 API 在扩展内同步恢复可用。
