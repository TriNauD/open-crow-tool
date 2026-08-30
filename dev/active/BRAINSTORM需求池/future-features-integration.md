# Future Features 集成约定

> 本批 B/C/D 新需求**不直接合 `dev` / `main`**，先汇入集成分支，待用户手测与排期后再合 Preview。  
> **接手手册（详尽）**：[`FUTURE-FEATURES-HANDOFF.md`](./FUTURE-FEATURES-HANDOFF.md) ← 代码地图、进度、风险、第一天清单

## 分支

| 角色 | 分支名 | 说明 |
|------|--------|------|
| 集成分支 | **`fea/future-features`** | 从最新 `origin/dev` 切出并长期维护；新功能合入此处 |
| 功能分支 | **`fea/<简称>-wesrindo`**（或仓库习惯 owner） | 从**最新** `fea/future-features` 切出，短生命周期 |

```bash
# 首次 / 同步基线
git fetch origin
git checkout fea/future-features
git pull origin fea/future-features   # 或必要时 merge origin/dev

# 开工一条
git checkout -b fea/<简称>-wesrindo
# …实现、测通、commit…
git checkout fea/future-features
git merge --no-ff fea/<简称>-wesrindo
git push origin fea/future-features
```

**禁止**：在 `dev` / `main` 上直改业务代码；本流水线默认 **不要** 向 `dev` 提 PR，除非用户另说。

## 自动门禁（合入 future 前必过）

在仓库根（Node 见 `.nvmrc`，建议 `nvm use`）：

1. `npm run lint`
2. 相关 `npm run test`（至少改动波及的单测；全量更稳）
3. 若改扩展 / 页面 E2E：先 `cd chrome-extension && npm ci && npm run build`，再跑针对性 `npm run test:e2e` / `test:e2e:ext`

合入方式：优先 **merge commit**（`--no-ff`），保留功能分支历史。

## 手测文档（保姆级）

每条合进 future 的需求须附带**之后可照着点的**手动测试文档（比 Preview 最小路径更细）：

- 推荐路径：`dev/active/<需求简称>/<需求简称>-manual-test.md`
- 或加厚：`*-dev-preview-acceptance.md`（环境、账号、逐步点击、预期、失败看哪里）

模板要点：环境（本地 / future 部署 URL）→ 账号前置 → 编号步骤（点哪里、填什么）→ 每步预期 → 失败时看 Network / Console / 哪份 log。

## 与最终 `dev` 的关系

- `fea/future-features` = **预览前集成缓冲**；自动化绿 + 文档齐即可合入。
- 用户批量手测通过、决定上 Preview 时：再从 future **另开 PR → `dev`**（或用户指定节奏）。
- 上生产仍走 `dev` → `main`，见 `release-and-hotfix.mdc`。

## 本批进度表

> 更新于 2026-07-25：B-1～D-2 与 C-3 **均已合入** `fea/future-features`（D-2 为 stub/No-Go）。详尽缺口见 [handoff §3](./FUTURE-FEATURES-HANDOFF.md#3-进度总表)。

| 顺序 | 条目 | 功能分支 | 合入 future | 手测文档 | 备注 |
|------|------|----------|-------------|----------|------|
| 1 | B-1 笔记分类 | `fea/note-categories-wesrindo` | ✅ | `dev/active/笔记分类/笔记分类-manual-test.md` | `tags[0]` MVP；用户手测待做 |
| 2 | B-2 划词上下文 | `fea/selection-context-wesrindo` | ✅ | `dev/active/划词上下文/划词上下文-manual-test.md` | `surroundingText` |
| 3 | C-1 名词解释与消歧 | `fea/term-disambiguation-wesrindo` | ✅ | `dev/active/名词解释与消歧/名词解释与消歧-manual-test.md` | prompt 规则 |
| 4 | C-2 截图上传 | `fea/screenshot-upload-wesrindo` | ✅ | `dev/active/截图上传/截图上传-manual-test.md` | 需 vision 模型 |
| 5 | 划词保存重复笔记校验 | `fea/ext-note-duplicate-wesrindo` | ✅ | `dev/active/划词保存重复笔记校验/划词保存重复笔记校验-manual-test.md` | 扩展对齐 Web |
| 6 | C-3 Chrome扩展内登录 | `fea/chrome-ext-inapp-login-wesrindo` | ✅ | `dev/active/Chrome扩展内登录/Chrome扩展内登录-manual-test.md` | 方案 A password grant |
| 7 | D-1 链接内容抓取 | `fea/url-fetch-wesrindo` | ✅ | `dev/active/链接内容抓取/链接内容抓取-manual-test.md` | `POST /api/fetch-url` + SSRF |
| 8 | D-2 飞书等平台 | `fea/feishu-eval-stub-wesrindo` | ✅ stub/No-Go | `dev/active/飞书等平台/飞书等平台-evaluation.md` + `…-manual-test.md` | `POST /api/feishu/events` → 501 |
| 9 | 扩展登录丝滑化 | `fea/ext-inline-login-wesrindo` | ✅ | `dev/active/扩展登录丝滑化/扩展登录丝滑化-manual-test.md` | 卡片/Popup 内嵌登录 + 过期就近恢复；manifest 0.1.26；手测待做 |
| 10 | Web 会话检查超时兜底 + 扩展类型链修复 | `fea/web-session-check-timeout-wesrindo` | ✅ | 无独立手测文档（随网站常规回归） | token 过期刷新卡住时 6s 超时先渲染，onAuthStateChange 恢复后切回（2026-08-30） |

> 更新约定：某条 merge 进 future 后，将对应行改为 ✅ 并填分支名与文档路径；状态细节同步 [handoff](./FUTURE-FEATURES-HANDOFF.md)。
