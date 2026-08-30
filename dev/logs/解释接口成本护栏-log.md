# 解释接口成本护栏 — Bug 记录

`/api/explain` 公开烧钱接口的防滥用加固。主题独立成档；后续同接口的迭代可追加。

### BF-1：/api/explain 完全公开无限流无输入上限，付费 key 可被任意消耗（2026-08-31）

- **现象**：`POST /api/explain` 无需登录即可调用，正文 `text` 无长度上限、无按 IP 限流；任何人 POST 文本就消耗 SiliconFlow/NVIDIA 付费 key（图片约 1.2MB 与 `surroundingText` 400 字符有上限，正文反而没有；`max_tokens: 400` 只管输出不管输入）。复现：`curl -X POST .../api/explain -d '{"text":"超长文本..."}'` 直接出流式解释。
- **根因**：接口设计初期为个人工具未设防；`/api/subscribe` 有内存限流而 explain 漏配；serverless 内存 Map 跨实例失效，需共享存储才能真限流。
- **涉及文件**：`lib/request-guard.ts`（新增：Upstash Redis 优先 + 内存兜底 fail-open 的固定窗口限流、`getClientIp`、Origin 纵深防御）、`app/api/explain/route.ts`（三道护栏：403 Origin / 429 Retry-After 默认 60 次/h/IP / 413 正文 > 12000 字符，`context` 截断 2000）、`.env.local.example`（`UPSTASH_REDIS_REST_*`、`RATE_LIMIT_EXPLAIN_PER_HOUR`）。
- **验证**：`npm run test` 25 passed（含 `__tests__/request-guard.test.ts` 10 用例）；curl 手测 413（超长）/ 403（第三方 Origin）/ 正常流式返回不受影响；`npm run lint` 0、`npm run build` 通过。生产生效需在 Vercel 配 `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`（未配则退内存兜底）。
- **分支 / PR**：`bugfix/explain-cost-guard` → [#32](https://github.com/TriNauD/open-crow-tool/pull/32)
- **备注**：`/api/fetch-url`（仅存在于 `fea/future-features` 管道）已加同款护栏（`fea/fetch-url-cost-guard`，限流 20 次/h/IP + URL ≤ 2048）；个人自用场景 60 次/h 充裕，误触 429 可调环境变量放宽。
