# Chrome 扩展站点兜底域 — Bug 记录

### BF-1：未连接/未登录兜底域硬编码 dev 站，生产用户请求打到团队 Preview（2026-08-31，ROADMAP R11）

- **现象**：生产用户未连接账号时划词解释，请求打到 `https://dev.crowknows.tech/api/explain`（团队 Preview）；Preview 开着 Vercel 部署保护时直接 401，划词报「网炸了或者 AI 挂了」。#33 合入后 `getBuildSiteOrigin()`（扩展内登录默认 apiBaseUrl、Options 占位符）也默认 dev，同样受影响。
- **根因**：`chrome-extension/src/content/App.tsx` 的 `FALLBACK_API_BASE_URL` 与 `crow-session.ts` 的 `getBuildSiteOrigin()` 硬编码 dev 域，缺少「按构建注入、默认生产」的机制。
- **涉及文件**：`chrome-extension/src/lib/crow-session.ts`（`getBuildSiteOrigin` 默认生产域）、`chrome-extension/src/content/App.tsx`（未连接兜底与其统一同用 `VITE_PUBLIC_SITE_ORIGIN`）、`chrome-extension/.env.example`（默认生产域，联调显式改 dev）、`chrome-extension/src/vite-env.d.ts`（注释）、`docs/tech/environments-and-deployment.md` §5。
- **验证**：构建产物检查——默认 `vite build` 仅含 `www.crowknows.tech`；`VITE_PUBLIC_SITE_ORIGIN=https://dev.crowknows.tech vite build` 覆盖生效。lint / test / build 全绿。
- **分支 / PR**：`bugfix/ext-fallback-prod-url` → [#40](https://github.com/TriNauD/open-crow-tool/pull/40)（待合并）
- **备注**：环境变量统一收敛为 `VITE_PUBLIC_SITE_ORIGIN` 一个旋钮：不设置 → 生产域（保护生产用户）；团队联调构建显式设 dev。
