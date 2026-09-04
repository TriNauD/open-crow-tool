# 用户自配 LLM — Bug 记录

> 用户自配 API 功能随 #33（fea/future-features）合入 dev；本档记录其安全迭代。

### BF-1：自配 LLM baseURL 只做字符串级校验，公网域名解析到内网 IP 可绕过（2026-08-31，ROADMAP R5）

- **现象**：`parseUserLLMConfig` 只调 `assertSafeHttpUrl`（检查 hostname 字符串、IP 字面量），未做 DNS 解析后校验。攻击者持有一个解析到 `127.0.0.1` / `10.x.x.x` / `169.254.169.254` 的公网域名时，配置可通过校验，服务端随后向内网地址发起带密钥的 LLM 请求（SSRF）。
- **根因**：`lib/url/fetch-safe.ts` 的 `assertHostResolvesPublic`（DNS 解析级校验）已存在但未导出、未接入用户自配链路。
- **涉及文件**：`lib/url/fetch-safe.ts`（导出 `assertHostResolvesPublic`）、`lib/ai/providers.ts`（`parseUserLLMConfig` 改 async，https 配置在字符串级校验后追加 DNS 解析级校验；本地 http 白名单不查 DNS）、`app/api/explain/route.ts`（调用点 await）。
- **验证**：`__tests__/providers-user-config.test.ts` 增 4 用例（解析到私网/混合记录任一私网即拒/DNS 查询失败/本地白名单不触发 DNS），mock `node:dns`；lint / test（65 passed）/ build 全绿。
- **分支 / PR**：`bugfix/user-llm-ssrf-dns` → [#37](https://github.com/TriNauD/open-crow-tool/pull/37)（待合并）
- **备注**：校验失败依旧静默回退服务器默认链，不给用户报错，行为与既有约定一致。
