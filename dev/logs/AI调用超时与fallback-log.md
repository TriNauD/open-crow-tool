# AI 调用超时与 fallback — Bug 记录

### BF-1：AI provider 链无超时，主通道挂起时 fallback 形同虚设（2026-08-31，ROADMAP R2）

- **现象**：主 provider「挂起而非报错」时，用户端一直转圈直至 SDK 默认超时（约 10 分钟）；weekly-digest 同理会吃光 Vercel 60s maxDuration。复现：mock 一个不返回的 provider 即可观察 fallback 不生效。
- **根因**：`client.chat.completions.create` 未设超时，用 SDK 默认值；且 SDK 默认 `maxRetries: 2`，会把单次挂起的代价放大成 timeout × 3。
- **涉及文件**：`lib/ai/providers.ts`（新增 `withProviderTimeout`、`runProviderChain`，客户端 `maxRetries: 0`）、`app/api/explain/route.ts`（18s 超时切下一家）、`app/api/cron/weekly-digest/route.ts`（单次超时 = min(配置值, AI 阶段总预算 40s)）、`.env.local.example`（`AI_PROVIDER_TIMEOUT_MS`）。
- **验证**：`__tests__/provider-timeout.test.ts` 10 用例（挂起超时中断/错误透传/流式 resolve 后不计时/链式切换）；lint / test / build 全绿。
- **分支 / PR**：`bugfix/ai-provider-timeout` → [#34](https://github.com/TriNauD/open-crow-tool/pull/34)（待合并）
- **备注**：超时只约束「发起调用到开始返回」，拿到流后停止计时，慢流式输出不受影响。
