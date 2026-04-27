# Chrome 扩展多用户鉴权 — Tasks

> 分支：`fea/chrome-ext-user-auth-tri`  
> **结项**：2026-04-27，**用户验收通过**；文档已迁 `dev/done/Chrome扩展多用户鉴权/`

## 已完成

- [x] 扩展 `chrome.storage.sync` 配置项由 `adminSecret` 改为 `accessToken`
- [x] `POST /api/notes` 改用 `Authorization: Bearer`，body 带 `source: 'chrome_extension'`
- [x] `Options.tsx` / `popup/main.tsx` 文案与校验逻辑更新；保存时清理旧 `adminSecret`
- [x] `chrome-extension` 本地 `npm run build` 通过
- [x] `manifest.json` 版本更新至 0.1.1

### Web 端：连接按钮

- [x] `components/AuthNav.tsx`（已登录时）新增「连接插件」按钮
- [x] `postMessage` + 乐观 UI；`index.tsx` 顶层桥接、`samePageOrigin`、CORS `Authorization`

### 扩展 — content script 桥接

- [x] `index.tsx` **顶层**注册 `message` 监听（Crow 自站点不挂载 `App` 时也必须可用）
- [x] 校验：`data.apiBaseUrl` 与 `e.origin` 同源（`lib/utils/same-page-origin.ts`）
- [x] `set` + `remove('adminSecret')` → `CROW_CONNECT_EXT_OK`

### 扩展 — Options / ExplainCard

- [x] Options 状态界面 + 手动备用；401/过期/通用错误文案
- [x] `lib/utils/cors.ts`：`Access-Control-Allow-Headers` 含 `Authorization`（BF-5）

### QA / 自动化

- [x] `Chrome扩展多用户鉴权-qa.md`；`npm run test`（Vitest：CORS + samePageOrigin）
- [x] 用户手测最小路径 + 验收通过（见 QA §5）

## 收尾（已完成）

- [x] `git commit`（多笔，见 `dev/logs/Chrome扩展多用户鉴权-log.md` Git 表）
- [ ] PR → `dev`（由协作者发起，不在此自动开 PR）
- [x] 文档迁移至 `dev/done/Chrome扩展多用户鉴权/`
- [x] `dev/logs/Chrome扩展多用户鉴权-log.md`
- [x] `docs/PRD.md` / `docs/PLAN.md` 同步扩展鉴权（结项更新）
