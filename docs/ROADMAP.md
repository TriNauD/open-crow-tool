# 这是啥？— Roadmap（「把现有功能做扎实」主线）

> 版本：v0.1 | 作者：PM + TL | 最后更新：2026-08-31
> **2026-08-31 夜间批次**：P0 全部（R2～R5）与 P1 小项（R6 Web 端、R7、R8、R11）已完成开发并提 PR（🟨 标注 PR 号），待逐个 Review + Preview 验证后 merge；另产出 [`docs/用户手册.md`](./用户手册.md)。
> **v0.1**：首版。基于 2026-08-31 的全库技术与体验评审整理，以**固化现有核心链路**（解释 → 保存 → 搜索 → 订阅周报 → 扩展划词）为唯一主线；**不新增产品能力**。

**与其它文档的关系**：本文是执行**排序与验收口径**，不替代立项文档——每项开工时仍按 `dev-workflow.md` 分流（**Bug 性质**走 `bugfix/*` + `dev/logs` BF 存档；**行为变更/新能力**走五阶段立项，建 `dev/active/…`）。条目立项后在本表更新状态并链到对应 `dev/active/` 目录；新想法仍先进 [`notes/需求与反馈收件箱.md`](../notes/需求与反馈收件箱.md)，不直接进本表。

**优先级口径**

- **P0 止损加固**：有成本、安全或用户流失风险的缺陷与缺口，先还清。
- **P1 体验补强**：高频路径（问、答、存、搜）上可感知的体验缺口。
- **P2 可靠性/规模**：数据量与用户量上来前补好的工程项。
- **P3 增长运营**：主线扎实之后才启动的传播与运营项。

**状态标记**：⬜ 未开始 ｜ 🔵 立项中 ｜ 🟨 进行中 ｜ ✅ 完成（含 `dev/done` 链接）

---

## 一、P0 止损加固（先做）

| 编号 | 事项 | 流程建议 | 规模 | 状态 |
|------|------|----------|------|------|
| R1 | `/api/explain` 输入上限 + 限流 | 小立项（安全加固） | M | ✅ [#32](https://github.com/TriNauD/open-crow-tool/pull/32)，存档 [BF-1](../dev/logs/解释接口成本护栏-log.md) |
| R2 | AI provider 链加超时，让 fallback 真正生效 | bugfix | S | 🟨 [#34](https://github.com/TriNauD/open-crow-tool/pull/34) |
| R3 | 退订两步化，防邮件预取误退订 | bugfix | S–M | 🟨 [#36](https://github.com/TriNauD/open-crow-tool/pull/36) |
| R4 | 周报/欢迎邮件 HTML 转义 + URL 校验 | bugfix | S | 🟨 [#35](https://github.com/TriNauD/open-crow-tool/pull/35) |
| R5 | 自配 LLM baseURL 补 DNS 解析级 SSRF 校验 | bugfix | S | 🟨 [#37](https://github.com/TriNauD/open-crow-tool/pull/37) |

- **R1 `/api/explain` 输入上限 + 限流**
  - 问题：公开接口无文本长度上限（`text` 不限，仅 surroundingText 400 字符、图片约 1.2MB），也无按 IP 限流；任何脚本可直接消耗 SiliconFlow/NVIDIA 付费 key。`/api/fetch-url` 同样无限流。
  - 动作：文本上限 **16k 字符**（覆盖 `fetch-url` 12k 截断后的合成正文）；按 IP 限流，Vercel serverless 上用共享存储（如 Upstash Redis，约 20 次/分钟/IP），无共享存储时先落内存版并注明局限。
  - 涉及：`app/api/explain/route.ts`、新增 `lib/api/rate-limit.ts`、`__tests__`。
  - 验收：超长输入返回 4xx 且文案友好；同 IP 超频返回 429；正常链接解释（约 12k 正文）不受影响；Vitest 覆盖边界。
- **R2 provider 链加超时**
  - 问题：`client.chat.completions.create` 用 SDK 默认超时（约 10 分钟），主通道「挂起而非报错」时用户一直转圈，fallback 链形同虚设。
  - 动作：每次调用加 15～20s 超时（AbortSignal/SDK timeout），超时即切下一 provider；`weekly-digest` 同步处理（注意 60s 总预算）。
  - 涉及：`app/api/explain/route.ts`、`app/api/cron/weekly-digest/route.ts`（或下沉到 `lib/ai/providers.ts` 统一封装）。
  - 验收：测试内 mock 挂起 provider，超时后落到下一家；用户端最坏等待有上限。
- **R3 退订两步化**
  - 问题：`GET /api/unsubscribe` 收到请求即改库；Apple Mail 隐私代理、Outlook SafeLinks 等会**自动预取**邮件内链接 → 用户没点就被退订，周报直接流失。
  - 动作：GET 只渲染确认页（带 token），用户点「确认退订」按钮才 POST 真正取消；退订确认邮件逻辑不变。
  - 涉及：`app/api/unsubscribe/route.ts`、`app/unsubscribe/page.tsx`。
  - 验收：`curl` 直接 GET 后订阅状态**不变**；页面上点确认后才取消；状态提示（success/notfound）保留。
- **R4 邮件 HTML 转义与 URL 校验**
  - 问题：`buildEmailHtml` 将 AI 产出的 `name/summary/url` 原样插入 HTML（内容源自 GitHub 描述），含 `"` `<` 会破坏排版或注入标签；`item.url` 未校验协议。`escapeHtml` 已存在但只用于运维邮件。
  - 动作：订阅者邮件全量转义；`parseReviewedRepos` 校验 `url` 必须 `https://github.com/` 前缀，否则回退 `https://github.com/{name}`。
  - 涉及：`lib/email.ts`、`app/api/cron/weekly-digest/route.ts`、`__tests__`。
  - 验收：含特殊字符 summary 渲染为纯文本；非法 URL 不进邮件。
- **R5 自配 LLM SSRF 补 DNS 校验**（用户自配功能已随 #33 进 dev，本项已可直接落地）
  - 问题：`parseUserLLMConfig` 只调 `assertSafeHttpUrl`（检查 hostname 字符串），未做解析后 IP 校验——公网域名解析到内网 IP 可绕过。
  - 动作：将 `lib/url/fetch-safe.ts` 的 `assertHostResolvesPublic` 导出并接入；本地 http 白名单逻辑保持。
  - 涉及：`lib/url/fetch-safe.ts`、`lib/ai/providers.ts`、`__tests__/providers-user-config.test.ts`。
  - 验收：mock DNS 解析到私网 IP 的域名被拒，正常公网域名不受影响。

---

## 二、P1 体验补强（P0 后紧跟）

| 编号 | 事项 | 流程建议 | 规模 | 状态 |
|------|------|----------|------|------|
| R6 | 解释卡片「复制」「重试」按钮 | 小立项 | S–M | 🟨 [#39](https://github.com/TriNauD/open-crow-tool/pull/39)，Web 端先行；扩展端对表未做 |
| R7 | 移动端触屏 Enter 换行 | 并入 v1.8 需求 | S | 🟨 [#41](https://github.com/TriNauD/open-crow-tool/pull/41) |
| R8 | 笔记本搜索改前端本地过滤 | bugfix | S | 🟨 [#38](https://github.com/TriNauD/open-crow-tool/pull/38) |
| R9 | 长文/整页解释输出分档 | 小立项 | M | ⬜ |
| R10 | 「读取链接」入口强化（先提示、后接口化） | 分两步 | S→M | ⬜ |
| R11 | 扩展未登录兜底 URL 指向生产域 | bugfix | S | 🟨 [#40](https://github.com/TriNauD/open-crow-tool/pull/40) |
| R12 | 订阅 double opt-in（确认邮件） | 立项（行为变更） | M | ⬜ |

- **R6 复制/重试**：解释是产品核心产物，「复制」是刚需；流式失败目前只有红字报错，加「重试」原样重发。Web 端（`components/ExplanationCard.tsx`、`hooks/useStreamExplain.ts`）先行，扩展端 `ExplainCard` 对表。验收：失败态出现重试且重发同一请求；复制得到完整纯文本。
- **R7 移动端换行**：进行中的 **v1.8「Web 首页 Enter 发送 / Alt+Enter 换行」**（`dev/active/Web首页Enter发送Alt换行/`）只覆盖桌面键位；触屏无 Alt/Shift，Enter 被拦截后**无法换行**。建议并入该需求的 QA 范围：触屏（`pointer: coarse` 等判定）Enter 一律换行、仅按钮发送；角标文案移动端维持隐藏。
- **R8 搜索本地过滤**：`searchNotes` 将输入原样拼进 PostgREST `.or()`（逗号/`%` 会 400 或错配），而笔记本页无搜索时本就全量拉到前端——改为前端过滤（复用游客侧逻辑），数据量大后再上 Postgres 全文索引（见 R17）。验收：含逗号、`%` 的关键词不再报错，结果与原逻辑抽样一致。
- **R9 输出分档**：system prompt 写死「3～5 句」+ `max_tokens: 400`，对整页/链接解释过短且截断无提示。按输入长度分档：短术语维持现状，长文/链接放宽（约 800～1000 tokens、段落式），超限时给「已截断」提示。涉及 `lib/ai/prompts.ts`、`app/api/explain/route.ts`；prompt 质量需人工 QA 抽评。
- **R10 链接入口**：现状仅在输入恰为纯 URL 时出现小按钮。第一步先做「检测到链接」明显提示；第二步让 `/api/explain` 支持 URL 参数由服务端抓取一步到位（依赖 R1 的上限口径）。每步独立可上线。
- **R11 扩展兜底 URL**：`chrome-extension/src/content/App.tsx` 将未登录兜底 API 硬编码为 `https://dev.crowknows.tech`，生产用户未登录时解释请求打到 dev。改为构建注入默认生产域，dev 仅开发构建使用。验收：生产扩展未登录请求打到生产 API。
- **R12 double opt-in**：订阅无邮件确认，任何人可拿他人邮箱刷订阅（骚扰向量）。加确认邮件后才入库 active；与 R3 同属订阅域，建议一个立项做完。验收：未确认前不收周报；重发确认幂等。

---

## 三、P2 可靠性与规模（量级信号出现前补齐）

| 编号 | 事项 | 触发条件 / 要点 | 规模 | 状态 |
|------|------|------------------|------|------|
| R13 | 笔记分页 | `GET /api/notes` 加 limit/cursor + 笔记本「加载更多」；单用户笔记 >200 条前完成 | M | ⬜ |
| R14 | 周报发送分批 | 顺序发送 + 600ms 间隔 + `maxDuration: 60` → 约 90 人即超时；先分批+进度日志，队列化（如 QStash）后置 | M | ⬜ |
| R15 | Trending 抓取降级 | cheerio 依赖 GitHub 页面结构，改版即挂；缓存上次成功结果兜底 + 失败告警（现有 ops 邮件复用） | S | ⬜ |
| R16 | 限流基建统一 + CORS 收紧 | R1 落地后把 `subscribe` 内存限流迁到同一套；CORS 从 `*` 收紧到自家域 + 扩展 origin；清理 `x-admin-secret` 残留 | S–M | ⬜ |
| R17 | 笔记全文检索 | R8 上线后仍嫌慢再做（pg full-text / tsvector） | M | ⬜ |

---

## 四、P3 增长与运营（主线扎实后启动）

| 编号 | 事项 | 要点 | 状态 |
|------|------|------|------|
| R18 | 基础埋点 | 解释发起/完成/保存/订阅漏斗（自托管 Umami/Plausible 即可）；在此之前不凭感觉扩功能 | ⬜ |
| R19 | 分享 + OG 卡片 | 解释结果一键分享并生成 OG 图——产品最自然的传播环 | ⬜ |
| R20 | SEO 基础 | sitemap / robots / OG meta | ⬜ |
| R21 | 笔记导出 | Markdown 导出；游客态明示「清浏览器数据会丢」 | ⬜ |

---

## 五、非目标（本主线内不做）

- **新平台接入**（飞书等，维持 `app/api/feishu` 占位与既有 evaluation 结论）；
- **付费/会员、i18n、移动 App、AI 厂商管理后台**等新能力；
- 理由：本期口径是「把现有功能做扎实」，新能力一律先进收件箱/需求池，主线收官后再议。

## 六、节奏与完成口径

- **批次 1（P0 全部）**：R1～R5，多为 S～M 的独立小改动，可各自分支小 PR；完成即「付费 key 挂在门口、邮件注入、误退订」三类风险清零。
- **批次 2**：R3 若未随批次 1 完成 + R8、R11（小改动止损）。
- **批次 3（体验主线）**：R6、R7、R9、R10（建议同批 QA：一条「问→答→失败重试→复制→存→搜→移动端」主线走查）。
- **P1 完成 = 核心链路在移动端与失败场景下可自愈**；P0 + P1 完成 = 本主线收官，回到常规需求流。
- 每项开工前按口径分流（bugfix / 立项），合并后按 `dev-workflow` 更新本表状态与链接。
