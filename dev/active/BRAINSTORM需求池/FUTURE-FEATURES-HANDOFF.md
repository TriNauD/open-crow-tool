# Future Features 接手手册（`fea/future-features`）

> **写给下一个接手人**：本文件是 B/C/D 本批集成的**单一真相入口**。  
> 配套约定：[`future-features-integration.md`](./future-features-integration.md) · 池索引：[`README.md`](./README.md) · 路线图：[`roadmap.md`](./roadmap.md)  
> 文档修订日期：2026-07-25 · 基线 HEAD：见下文「分支/commit 现状」

---

## 1. 背景与目标

### 为何有 `fea/future-features`

BRAINSTORM 阶段 A 已结项；阶段 **B / C / D** 一批功能（笔记分类、划词上下文、消歧、截图、扩展登录、链接抓取、飞书选型等）需要**成批编码与互测**，但**尚未**决定整包上 Preview / 生产。

因此使用长期集成分支 **`fea/future-features`**：

| 角色 | 说明 |
|------|------|
| 缓冲集成 | 各短生命周期 `fea/<简称>-wesrindo` 先 **merge commit** 合入此处 |
| 与 `dev` | 基线自 `origin/dev` 切出；**默认不要**向 `dev` 开 PR，除非用户明确授权 |
| 与 `main` | **禁止**把本分支当生产；上生产仍须 `dev` → `main`（见 `release-and-hotfix.mdc`） |

### 当前不要误合生产的提醒

1. **不要**对 `main` 提 PR / 直推。  
2. **不要**在未获用户口头「可以合 Preview / 提 PR 到 dev」时，从本分支向 **`dev`** 开 PR。  
3. Vercel 只对 `main` / `dev` 部署；本分支本身**不会**自动上 Preview。本地 / 自建部署验证即可。  
4. 合 `dev` 前须完成：自动化绿、各条保姆级手测、用户批量验收；再另开 PR。

---

## 2. 分支 / commit 现状（接手时请先 `git fetch` 复核）

| 项 | 值（文档撰写时） |
|----|------------------|
| 集成分支 | `fea/future-features` |
| 上游 | `origin/fea/future-features`（已 push，与本地一致） |
| 功能集成 HEAD | `f662f7a` — *Merge branch 'fea/chrome-ext-inapp-login-wesrindo' into fea/future-features*（本批最后一条功能 merge） |
| 文档/handoff HEAD | `5ed1822` — *docs: Future Features 接手手册与进度索引对齐*（本文件及索引；以 `git rev-parse` 为准） |
| merge-base vs `origin/dev` | `f11c58a`（`origin/dev` 即此 commit；future **领先**，无落后） |
| 相对 `origin/dev` | **25+** 个 commit（含 8 次功能 merge + 文档）；功能 diff 约 **93 files / +3618 / −251**（不含后续纯文档） |
| 是否已 push | **是**（接手时请 `git fetch` 复核） |

### 已合入的功能分支（merge commit 顺序）

| 顺序 | Merge commit | 功能分支 | 需求 |
|------|--------------|----------|------|
| 1 | `0214127` | `fea/note-categories-wesrindo` | B-1 笔记分类 |
| 2 | `8f2358b` | `fea/selection-context-wesrindo` | B-2 划词上下文 |
| 3 | `6618c2d` | `fea/term-disambiguation-wesrindo` | C-1 名词解释与消歧 |
| 4 | `747b87d` | `fea/screenshot-upload-wesrindo` | C-2 截图上传 |
| 5 | `3a556a1` | `fea/ext-note-duplicate-wesrindo` | 划词保存重复笔记校验 |
| 6 | `8499cfa` | `fea/url-fetch-wesrindo` | D-1 链接内容抓取 |
| 7 | `91d1713` | `fea/feishu-eval-stub-wesrindo` | D-2 飞书 stub / No-Go |
| 8 | `f662f7a` | `fea/chrome-ext-inapp-login-wesrindo` | C-3 扩展内登录 |

> 进度表上 C-3 排在「重复校验」与 D-1 之间；**实际 merge 顺序**是 D-1 / D-2 先合、C-3 最后合——功能上互不阻塞，接手时以 HEAD 全量为准。

### 相对 `dev` 的文件级变更摘要（按需求）

| 需求 | 主要代码 / 测试 | 文档 |
|------|-----------------|------|
| B-1 | `lib/notes/tags.ts`、`lib/db/notes.ts`、`app/api/notes/**`、`app/notebook/page.tsx`、`lib/guest-notes.ts`、`__tests__/note-tags.test.ts` | `dev/active/笔记分类/*`、`docs/product/notebook.md` |
| B-2 | `chrome-extension/.../surrounding-text.ts`、`App.tsx`、`useStreamExplain.ts`、`app/api/explain/route.ts`、`lib/ai/prompts.ts`、`__tests__/explain-prompt.test.ts` | `dev/active/划词上下文/*` |
| C-1 | `lib/ai/prompts.ts`（`DISAMBIGUATION_RULES`）、`__tests__/prompts-disambiguation.test.ts` | `dev/active/名词解释与消歧/*` |
| C-2 | `lib/ai/image-limits.ts`、`lib/client/compress-image.ts`、`app/page.tsx`、`hooks/useStreamExplain.ts`、`components/ExplanationCard.tsx`、`app/api/explain/route.ts`、`__tests__/image-limits.test.ts` | `dev/active/截图上传/*`、`.env.local.example` vision 注释 |
| 重复校验 | `chrome-extension/.../ExplainCard.tsx`、`normalize-note-input.ts`、`lib/notes/normalize-input.ts`、相关单测 | `dev/active/划词保存重复笔记校验/*` |
| C-3 | `Options.tsx`、`supabase-password-login.ts`、`crow-session.ts`、`manifest` 0.1.25、`chrome-extension/.env.example`、`__tests__/supabase-password-login.test.ts` | `dev/active/Chrome扩展内登录/*`、`docs/product/chrome-extension.md`、`auth.md` |
| D-1 | `lib/url/fetch-safe.ts`、`app/api/fetch-url/route.ts`、`app/page.tsx`、`__tests__/fetch-safe-ssrf.test.ts` | `dev/active/链接内容抓取/*` |
| D-2 | `app/api/feishu/events/route.ts`（501）、`__tests__/feishu-stub.test.ts`、env 占位注释 | `飞书等平台-evaluation.md` 等 |

横切：`lib/utils/cors.ts`、`.gitignore` 小改、产品/技术 README「进行中」索引。

---

## 3. 进度总表

| ID | 条目 | 状态 | 自动化门禁（合 future 时） | 手测文档 | 已知缺口 |
|----|------|------|---------------------------|----------|----------|
| **B-1** | 笔记分类 | **已合 future** | lint + `__tests__/note-tags.test.ts` | [`笔记分类-manual-test.md`](../笔记分类/笔记分类-manual-test.md) | 用户手测未勾；无独立 `qa.md`；扩展保存不带分类（有意） |
| **B-2** | 划词上下文 | **已合 future** | lint + `explain-prompt` 单测 | [`划词上下文-manual-test.md`](../划词上下文/划词上下文-manual-test.md) | 用户手测未勾；无 Options 开关；surrounding 不落库 |
| **C-1** | 名词解释与消歧 | **已合 future** | lint + `prompts-disambiguation` | [`名词解释与消歧-manual-test.md`](../名词解释与消歧/名词解释与消歧-manual-test.md) | 效果依赖模型；需样例手测 |
| **C-2** | 截图上传 | **已合 future** | lint + `image-limits` | [`截图上传-manual-test.md`](../截图上传/截图上传-manual-test.md) | **须 vision 模型**；默认 `AI_MODEL` 若纯文本会失败 |
| **C-*** | 划词保存重复笔记校验 | **已合 future** | lint + normalize 相关单测 | [`划词保存重复笔记校验-manual-test.md`](../划词保存重复笔记校验/划词保存重复笔记校验-manual-test.md) | 用户手测未勾；Web/扩展 normalize 双份维护 |
| **C-3** | Chrome 扩展内登录 | **已合 future** | lint + `supabase-password-login` + 扩展 build | [`Chrome扩展内登录-manual-test.md`](../Chrome扩展内登录/Chrome扩展内登录-manual-test.md) | 手测 §A/C/D 未勾；**无 Magic link / 无扩展内注册**；邮箱未验证仅提示 |
| **D-1** | 链接内容抓取 | **已合 future** | lint + `fetch-safe-ssrf` | [`链接内容抓取-manual-test.md`](../链接内容抓取/链接内容抓取-manual-test.md) | 限流/登录门禁二期；抓取质量因站点而异 |
| **D-2** | 飞书等平台 | **stub / No-Go** | lint + `feishu-stub` | [`evaluation`](../飞书等平台/飞书等平台-evaluation.md) + [`manual-test`](../飞书等平台/飞书等平台-manual-test.md) | **不做**完整开放平台；真机「飞书网页+扩展」验证待用户 |

**整体**：编码与合入 future **已完成**；**批量用户手测、qa.md、PR → `dev`、结项迁 `dev/done` 均未做**。

---

## 4. 逐需求代码地图

### B-1 笔记分类

| 项 | 内容 |
|----|------|
| 入口 UI | `app/notebook/page.tsx`（chip：全部 / 未分类 / 已有类；卡片改分类） |
| 核心类型/工具 | `lib/notes/tags.ts`：`parseTagsInput`、`primaryCategory`、`matchesCategoryFilter`；**MVP：`tags[0]` = 主分类**，最多 1 个、长 ≤32 |
| API | `POST /api/notes` 可选 `tags`；`PATCH /api/notes/[id]` 改 tags；guest migrate 带 tags |
| 数据流 | 登录：`lib/db/notes.ts` ↔ API ↔ `lib/api/notes-client.ts`；游客：`lib/guest-notes.ts` → migrate |
| 筛选 | **客户端**筛分类；搜索仍 `?q=` |
| 测试 | `__tests__/note-tags.test.ts` |
| 从哪改起 | 分类规则 → `lib/notes/tags.ts`；UI → `app/notebook/page.tsx`；契约 → `app/api/notes/[id]/route.ts` |

### B-2 划词上下文

| 项 | 内容 |
|----|------|
| 入口 | 扩展 content：`surrounding-text.ts` ← `App.tsx` → `ExplainCard` → `useStreamExplain` |
| 字段 | 请求体 **`surroundingText`**（与追问字段 **`context` 分离**） |
| 截取 | 选区前后各约 **120** 字，中间 `【…】`；失败返回 `''` 静默降级 |
| 服务端 | `app/api/explain/route.ts` 截断；`lib/ai/prompts.ts` → `surroundingSection` |
| 测试 | `__tests__/explain-prompt.test.ts` |
| 从哪改起 | 截取策略 → `surrounding-text.ts`；prompt 形态 → `prompts.ts` |

### C-1 名词解释与消歧

| 项 | 内容 |
|----|------|
| 入口 | `lib/ai/prompts.ts` 常量 **`DISAMBIGUATION_RULES`** 拼进 `SYSTEM_PROMPT` |
| 数据流 | 无新 API；依赖 B-2 surrounding 辅助消歧 |
| 测试 | `__tests__/prompts-disambiguation.test.ts` |
| 从哪改起 | 只改 `DISAMBIGUATION_RULES` / system 拼装；勿改周报专用 prompt |

### C-2 截图上传

| 项 | 内容 |
|----|------|
| 入口 UI | `app/page.tsx` 粘贴/选图；`components/ExplanationCard.tsx`；`hooks/useStreamExplain.ts` |
| 客户端 | `lib/client/compress-image.ts` 压缩后 base64 |
| 服务端 | `validateExplainImage`（`lib/ai/image-limits.ts`）→ multimodal `image_url` |
| 限制 | png/jpeg/webp；约 **1.2MB** 解码上限 |
| Env | `.env.local.example`：`AI_MODEL` 须 **vision**（注释已写） |
| 测试 | `__tests__/image-limits.test.ts` |
| 从哪改起 | 体积/类型 → `image-limits.ts`；交互 → `app/page.tsx` |

### 划词保存重复笔记校验

| 项 | 内容 |
|----|------|
| 入口 | 扩展 `ExplainCard.tsx` 保存前 |
| 规范化 | Web：`lib/notes/normalize-input.ts`；扩展副本：`content/normalize-note-input.ts`（须保持一致） |
| UX | 与 Web 对齐：都保留 / 覆盖 |
| 测试 | `__tests__/normalize-note-input.test.ts` |
| 从哪改起 | 先改 Web normalize + 单测，再同步扩展副本与 `ExplainCard` |

### C-3 Chrome 扩展内登录

| 项 | 内容 |
|----|------|
| 入口 UI | `chrome-extension/src/options/Options.tsx`（主路径邮箱密码；高级折叠） |
| 登录实现 | `supabase-password-login.ts`：GoTrue **`grant_type=password`** 纯 fetch（**无** `@supabase/supabase-js`、**无** `identity`） |
| 会话 | 成功 → `persistCrowAuth` / `CrowAuth`（`crow-session.ts`）；与网站「连接插件」**后写覆盖** |
| Env（扩展构建） | `VITE_PUBLIC_SUPABASE_URL`、`VITE_PUBLIC_SUPABASE_ANON_KEY`、`VITE_PUBLIC_SITE_ORIGIN`（见 `chrome-extension/.env.example`） |
| manifest | **0.1.25** |
| 测试 | `__tests__/supabase-password-login.test.ts`（根 Vitest，测 map/error 与 fetch 行为） |
| 明确不做 | 方案 B（PKCE / identity）、Magic link、扩展内注册 |
| 从哪改起 | 登录协议 → `supabase-password-login.ts`；文案/布局 → `Options.tsx` |

### D-1 链接内容抓取

| 项 | 内容 |
|----|------|
| API | **`POST /api/fetch-url`** body `{ url }` → `{ data }` 或错误码 |
| SSRF 库 | `lib/url/fetch-safe.ts`：仅 http(s)、禁私网/localhost/凭据、DNS 校验、超时 **5s**、体积 **512KB**、正文截断 **12k** 字符、有限 redirect |
| UI | 首页「读取链接」确认后抓取，正文拼入 explain |
| 测试 | `__tests__/fetch-safe-ssrf.test.ts` |
| 从哪改起 | 安全策略 → `fetch-safe.ts`；产品交互 → `app/page.tsx` |

### D-2 飞书等平台（stub）

| 项 | 内容 |
|----|------|
| 结论 | **No-Go** 完整集成；推荐先手测「飞书网页版 + 现有扩展」 |
| 代码 | `POST|GET /api/feishu/events` → **501** + `FEISHU_NOT_ENABLED` |
| Env | `.env.local.example` 仅注释 `FEISHU_*` 占位 |
| 文档 | `飞书等平台-evaluation.md` |
| 从哪改起 | **商业 Go 前不要扩 SDK**；真要做再按 evaluation 选路径 B/C |

---

## 5. 本地跑通

### 运行时

- Node **`20.20.2`**（`.nvmrc`）+ npm **`10.8.2`**（`package.json` engines）
- `nvm use` 后仓库根：`npm ci`（不要随手 `npm install` 改 lock）

### Web

```bash
cp .env.local.example .env.local   # 填真实值；勿提交
npm run dev
# 门禁
npm run lint
npm run test
npm run build                      # 合 dev 前建议与 CI 对齐
```

### 扩展

```bash
cd chrome-extension
cp .env.example .env               # 或项目约定的 env 文件名；填 VITE_PUBLIC_*
npm ci
npm run build                      # 产出 dist，Chrome 加载未打包扩展用 dist
```

根目录扩展相关 E2E：

```bash
npm run test:e2e:ext               # 会先 build chrome-extension
# 或 npm run test:e2e
```

### Env 注意（无密钥）

| 变量族 | 用途 |
|--------|------|
| `AI_*` / `SILICONFLOW_*` / `NVIDIA_*` | 解释；**C-2 需要支持视觉的 `AI_MODEL`** |
| `NEXT_PUBLIC_SUPABASE_*` / `SUPABASE_*` | Web 与 RLS |
| `VITE_PUBLIC_SUPABASE_*` + `VITE_PUBLIC_SITE_ORIGIN` | **扩展构建时注入**；须与网站同一 Supabase 项目；`SITE_ORIGIN` 作默认 `apiBaseUrl` |
| `FEISHU_*` | 仅占位注释；stub 不读 |
| `NOTEBOOK_MULTI_USER_ENABLED` | 熔断开关 |

分环境细则：`docs/tech/environments-and-deployment.md`。

---

## 6. 架构决策与取舍

| 决策 | 选择 | 原因 / 代价 |
|------|------|-------------|
| 集成策略 | 长期 `fea/future-features` + 短 `fea/*-wesrindo` | 可互测、暂不污染 Preview |
| 合入方式 | **`merge --no-ff`**（merge commit） | 保留功能分支历史；与团队 PR 合并习惯一致 |
| B-1 分类 | **复用 `notes.tags`，`tags[0]` 主分类** | 无 migration；自由文本可能碎片化 |
| B-2 字段 | `surroundingText` ≠ `context` | 避免与追问上下文语义打架 |
| C-3 登录 | **方案 A**：Options + password grant fetch | 免 identity/回调白名单；无 Magic link / 扩展注册 |
| D-1 SSRF | 服务端 `fetch-safe` 默认拒绝私网 | 安全优先；部分内网文档抓不到（有意） |
| D-2 | **501 stub + No-Go** | 避免无商业依据的大工程 |
| C-2 图片 | inline base64 + 客户端压缩 | 无对象存储；受模型与体积限制 |

---

## 7. 风险与技术债

1. **Vision 模型（C-2）**  
   默认示例模型偏文本；未换 vision 时截图解释会失败。接手手测前先确认 `AI_MODEL` / provider。

2. **邮箱确认回调（C-3）**  
   扩展不做 Magic link；「邮箱未验证」只提示去网站点邮件。若产品要扩展内完成验证，需另立项（方案 B 或网站深链）。

3. **尚未 PR → `dev`**  
   整包未上 Preview；与 `origin/dev` 可能随时间漂移——合入前务必 `git fetch` 后 **merge `origin/dev` 进 future** 再提 PR。

4. **与 [PR #31](https://github.com/TriNauD/open-crow-tool/pull/31)（注册确认密码）的关系**  
   - 分支：`fea/register-password-confirm` → base **`dev`**，状态 **OPEN**。  
   - **未**合入 `fea/future-features`。  
   - 影响面主要是网站 `/register`，与 C-3 Options 登录**无直接代码重叠**，但最终 future → `dev` 时若 #31 已合，只需常规 merge `dev`；若两边并行改 auth 文案/页面，注意冲突。  
   - C-3 **不包含**扩展内注册；用户仍走网站注册（#31 改善的正是网站注册 UX）。

5. **双份 normalize（重复笔记）**  
   Web 与扩展各一份；改一边漏一边会行为分叉。

6. **手测 / qa 债务**  
   各 tasks 中「用户手测 PASS」「qa.md」多为未勾；结项前必须补。

7. **phase-2 技术分卷**  
   `docs/tech/phase-2-chrome-extension.md` 目录树仍偏旧（未列 `surrounding-text.ts` / 登录模块）；细节以本 handoff 与 `dev/active/Chrome扩展内登录/` 为准，合 `dev` 时可再刷分卷。

---

## 8. 接手检查清单

### 第一天读什么（建议顺序）

1. **本文**（全局地图 + 风险）  
2. [`future-features-integration.md`](./future-features-integration.md)（分支纪律与进度表）  
3. 你要动的那条 `dev/active/<需求>/` 下的 **plan + context + manual-test**（tasks 看勾选）

可选：`docs/product/chrome-extension.md` / `notebook.md` / `web-explainer.md` 中与本批相关的段落。

### 如何验证构建

```bash
git fetch origin
git checkout fea/future-features
git pull origin fea/future-features
nvm use
npm ci
npm run lint && npm run test
cd chrome-extension && npm ci && npm run build && cd ..
```

扩展：Chrome → 加载已解压的 `chrome-extension/dist`，按对应 `*-manual-test.md` 走最小路径。

### 如何开下一条 `fea/*`

```bash
git checkout fea/future-features
git pull origin fea/future-features
# 若长时间未同步：git merge origin/dev   # 解决冲突后再开工
git checkout -b fea/<简称>-wesrindo
# …实现、lint/test、保姆级手测文档…
git checkout fea/future-features
git merge --no-ff fea/<简称>-wesrindo
# 更新 integration 进度表 + 本 handoff 进度表（若状态变）
git push origin fea/future-features
```

### 如何最终 PR → `dev`（仅用户授权后）

1. `git merge origin/dev` 进 `fea/future-features`，解决冲突，再跑全套 lint/test/（相关）e2e。  
2. 用户确认手测后：`gh pr create --base dev --head fea/future-features`（或用户指定）。  
3. 合并方式优先 **Create a merge commit**。  
4. Preview 验收 → 更新各 `*-dev-preview-acceptance` / qa → 结项迁 `dev/done`、写 `dev/logs`。  
5. **不要**跳过 Preview 直接 `dev`→`main`。

---

## 9. 联系 / 约定

| 约定 | 说明 |
|------|------|
| Merge | 功能 → future、以及日后 PR 合 `dev`：**优先 merge commit**，避免 squash 打散本批历史 |
| 手测保姆文档 | 每条：`dev/active/<简称>/<简称>-manual-test.md`（D-2 另加 evaluation） |
| 集成约定正文 | [`future-features-integration.md`](./future-features-integration.md) |
| 规则入口 | `.cursorrules` → `dev-workflow` / `git-branching` / `pr-and-commit` |
| Owner 习惯 | 本批功能分支后缀 `-wesrindo`；新人可改自己的 owner 后缀，但须从 **最新 future** 切出 |

---

## 10. 快速命令备忘

```bash
# 相对 dev 看改了什么
git fetch origin
git log --oneline origin/dev..fea/future-features
git diff --stat origin/dev...fea/future-features

# 只跑本批相关单测（示例）
npx vitest run __tests__/note-tags.test.ts __tests__/explain-prompt.test.ts \
  __tests__/prompts-disambiguation.test.ts __tests__/image-limits.test.ts \
  __tests__/normalize-note-input.test.ts __tests__/supabase-password-login.test.ts \
  __tests__/fetch-safe-ssrf.test.ts __tests__/feishu-stub.test.ts
```

---

*若本文件与仓库代码冲突：以 `fea/future-features` 上的代码与各需求 `tasks.md` 勾选为准，并请顺手改本 handoff。*
