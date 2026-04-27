# Chrome 扩展多用户鉴权 — Tasks

> 分支：`fea/chrome-ext-user-auth-tri`

## 已完成

- [x] 扩展 `chrome.storage.sync` 配置项由 `adminSecret` 改为 `accessToken`
- [x] `POST /api/notes` 改用 `Authorization: Bearer`，body 带 `source: 'chrome_extension'`
- [x] `Options.tsx` / `popup/main.tsx` 文案与校验逻辑更新；保存时清理旧 `adminSecret`
- [x] `chrome-extension` 本地 `npm run build` 通过
- [x] `manifest.json` 版本更新至 0.1.1

## 待开发

### Web 端：连接按钮

- [x] `components/AuthNav.tsx`（已登录时）新增「连接插件」按钮
- [x] 点击后执行 `window.postMessage({ type: 'CROW_CONNECT_EXT', accessToken, apiBaseUrl: location.origin }, location.origin)`
- [x] 收到 `CROW_CONNECT_EXT_OK` 后按钮文案变为「✓ 插件已连接」（4 秒后自动恢复）

### 扩展 — content script 桥接

- [x] `index.tsx` **顶层**注册 `message` 监听（Crow 自站点不挂载 `App` 时也必须可用）
- [x] 校验：仅当 `data.apiBaseUrl` 与 `e.origin` 同源（`samePageOrigin`）时写入，避免旧 sync 中 prod `apiBaseUrl` 挡 localhost
- [x] 收到 `CROW_CONNECT_EXT` → `set` + `remove('adminSecret')` → 回传 `CROW_CONNECT_EXT_OK`

### 扩展 — Options 改版

- [x] 主界面改为「连接状态：已连接 ✓ / 未连接 ✗」+ 「打开网站」按钮
- [x] 折叠区域保留手动粘贴表单（备用，供自部署 / 开发者）
- [x] 旧版 `adminSecret` 检测，提示重新授权

### 扩展 — 401 精确引导

- [x] `ExplainCard.tsx` 存笔记返回 401/403 → `saveError: 'expired'` → 「⚠️ 登录已过期，请回网站点「连接插件」」+ 跳转链接
- [x] 网络/其他错误 → `saveError: 'generic'` → 「保存失败，请稍后重试」

## QA 阶段

- [x] 已创建并维护 `Chrome扩展多用户鉴权-qa.md`；**核心问题已确认修复**（见 QA §5 与执行记录）
- [ ] 全量用例（TC-01～TC-07、RT-01～RT-03）与 `next build`/`lint`：发版前或你指定窗口补跑并更新 `qa.md`
- [ ] PM 审核 `tasks` / `qa`，在最终「用户验收通过」上签字

## 收尾（用户验收后）

- [ ] `git commit`（按 `pr-and-commit.mdc` 规范）
- [ ] PR → `dev`
- [ ] 文档迁移至 `dev/done/Chrome扩展多用户鉴权/`
- [x] 问题与 keyfix 已记录：`dev/logs/Chrome扩展多用户鉴权-log.md`
- [ ] PM 视需要更新 `docs/PRD.md` 和 `docs/PLAN.md`（扩展「连接」用户路径）
