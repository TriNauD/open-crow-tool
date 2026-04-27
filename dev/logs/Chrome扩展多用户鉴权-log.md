# Chrome 扩展多用户鉴权 — 问题与 Keyfix 记录

> 功能分支建议：`fea/chrome-ext-user-auth-tri`  
> 与活动文档目录：`dev/active/Chrome扩展多用户鉴权/`

## 2026-04-27（Bugfix 轮次，已合入实现）

本记录归档开发与调试阶段出现的**真实缺陷**与**根因**，供后续回 regress 与 onboarding 用；验收结论以 `…-qa.md` 为准。

### BF-1：Crow 自站点不挂载 content script，连接逻辑从未注册

- **现象**：在 `localhost:3000` 或生产站点上点「连接插件」毫无反应。  
- **根因**：`chrome-extension/src/content/index.tsx` 中 `mount()` 在 `document.documentElement.dataset.crowNative === 'true'` 时直接 `return`；Web 的 `app/layout.tsx` 在 `<html>` 上设了 `data-crow-native="true"`，**自身站点不挂载** React 浮层，此前「连接」监听器又写在已卸载的 `App` 里 → 页面上**没有任何监听器**处理 `CROW_CONNECT_EXT`。  
- **修复**：将 `CROW_CONNECT_EXT` 的 `window.addEventListener('message', …)` 挪到 `mount()` **之外、模块顶层**，保证 Crow 站与第三方站都会注册桥接；`mount()` 仍跳过自身站点 UI，避免与原生页冲突。  
- **涉及文件**：`chrome-extension/src/content/index.tsx`

### BF-2：MV3 isolated world 中 `e.source === window` 恒假，消息被误杀

- **现象**：postMessage 已发出，仍无存储、无回包。  
- **根因**：在 content script 与页面隔离环境中，页面发的 `message` 的 `e.source` 与 content script 里的 `window` **不是同一引用**（Proxy/隔离世界），`e.source !== window` 比较长期为真 → **事件被 return**。  
- **修复**：**去掉**对 `e.source === window` 的依赖；后续仅靠 payload 的 `type` 与**同源/自洽校验**（见 BF-3）。  
- **涉及文件**：`chrome-extension/src/content/index.tsx`、早先曾误加在 `AuthNav` 的同类检查已移除。

### BF-3：已保存的 `apiBaseUrl` 为线上域时，在 localhost 点「连接」被旧逻辑误拦（核心用户可见 bug）

- **现象**：**网站**因乐观 UI 显示「已连接」或「已点成功感」，**扩展设置**仍显示「未连接」；`accessToken` 未写入。  
- **根因（运行时证据，session `821123` 日志）**  
  - 旧逻辑：`chrome.storage.sync.get` 后 `trusted = savedUrl || e.origin`；当 `savedUrl` 为历史配置（如 `https://www.crowknows.tech`）时，`trusted` 被固定为线上域；本地开发 `e.origin` 为 `http://localhost:3000` → `e.origin !== trusted` → **早退、不执行 `storage.set`**。  
  - 与乐观 UI 叠加：未等 storage 成功即变绿，形成**表观不一致**。  
- **修复**：**不再**用「已保存的 base URL」挡当前页。仅当 **`postMessage` 的 `data.apiBaseUrl` 与 `e.origin` 同源**（`samePageOrigin`）时写入，即可安全覆盖从 prod 切到 `localhost` 的自建场景。  
- **补充**：成功写入后 `chrome.storage.sync.remove('adminSecret')`，与 Options 手工保存行为一致。  
- **涉及文件**：`chrome-extension/src/content/index.tsx`（`samePageOrigin` + `set` 路径）

### BF-4：体验与可见性小项（非根因、已顺修）

- **说明**：`postMessage` 的 `targetOrigin` 曾用更宽松写法以避免隔离世界下的细微不一致；**乐观更新**在网站侧避免依赖扩展异步回包才变 UI。  
- **可见性**：「连接插件」由 `hidden sm:*` 改为**始终可点**（避免窄屏误以为功能坏掉），见 `components/AuthNav.tsx`。

### BF-5：CORS 的 `Access-Control-Allow-Headers` 未含 `Authorization`，扩展存笔记跨域失败

- **现象**：网站显示「已连接」后，在扩展里点「存入笔记本」报保存失败；浏览器 Network 中 `POST /api/notes` 可能为 (failed) 或 CORS 错误。  
- **根因**：`lib/utils/cors.ts` 中预检允许头只写了 `Content-Type, x-admin-secret`；多用户改造后请求改为 `Authorization: Bearer <jwt>`。非简单跨域 `fetch` 会发 OPTIONS，**服务器必须在 `Access-Control-Allow-Headers` 中显式允许 `Authorization`**，否则浏览器拦截，表现为 `fetch` 抛错 → 走「保存失败」类提示。  
- **修复**：在 `corsHeaders` 中增加 `Authorization`（与 `x-admin-secret` 并存无妨）。`OPTIONS` 与所有使用 `corsHeaders` 的 API 响应一并生效。  
- **涉及文件**：`lib/utils/cors.ts`；与扩展 `chrome-extension/.../ExplainCard.tsx` 仅请求侧有关。  
- **部署注意**：**必须**将 Web 端该改动部署到扩展里配置的 `apiBaseUrl`（本地 `npm run dev` 会立即生效；线上需发版后才生效）。

### 与调试埋点

- 曾使用本仓库 `.cursor/debug-821123.log` 与 ngest 端点做**一次性**排障；**问题确认后已删除全部 instrumentation**，勿再依赖该 session。

### 回 regress 时建议**最小复现/验证**

1. sync 中预置**旧线上** `apiBaseUrl`、无或旧 `accessToken`。  
2. 打开 `http://localhost:3000`，登录，点「连接插件」。  
3. 打开扩展 Options → 应为**已连接**，且 `apiBaseUrl` 为 `http://localhost:3000`（或与当前站一致）。  

---

## 后续（结项时由 PM/TL 补）

- 通过用户验收后：commit、PR `dev`、将 `dev/active/Chrome扩展多用户鉴权/` 迁 `dev/done/`、本 log 可追加「结项日期与版本号」一行。  
- 是否需要更新 `docs/PRD.md` / `docs/PLAN.md` 中「扩展连接」用户路径，由 PM 决定。
