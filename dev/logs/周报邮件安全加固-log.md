# 周报邮件安全加固 — Bug 记录

### BF-1：订阅者邮件将 AI/GitHub 产出的 name/summary/url 原样插入 HTML（2026-08-31，ROADMAP R4）

- **现象**：AI 评审产出或 Trending 抓取的仓库描述含 `"` / `<` / `&` 时，周报邮件排版被破坏，极端情况可注入标签；`item.url` 未校验协议，`javascript:` 等非法 URL 可进入邮件链接。
- **根因**：`buildEmailHtml` 直接插值；`escapeHtml` 已存在但只用于运维邮件；`parseReviewedRepos` 对 AI 返回的 `url` 仅做 `??` 兜底不做协议校验。
- **涉及文件**：`lib/email.ts`（订阅者邮件全量转义 + 各模板退订/重订链接转义）、`lib/github-trending.ts`（新增 `sanitizeGithubRepoUrl`：必须 `https://github.com/` 前缀，否则回退 `https://github.com/{name}`）、`app/api/cron/weekly-digest/route.ts`（接入校验）。
- **验证**：`__tests__/email-html-escape.test.ts` 8 用例（`<script>` 注入/属性破坏/非法 URL 回退/正常内容渲染不变）；lint / test / build 全绿。
- **分支 / PR**：`bugfix/email-html-escape` → [#35](https://github.com/TriNauD/open-crow-tool/pull/35)（待合并）
