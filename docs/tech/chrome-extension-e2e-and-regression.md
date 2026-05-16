# Chrome 扩展：划词浮标 / 连接回归与 E2E

本文记录 **划词浮标、网站连接、Options 同步** 等问题的原因与修复口径，以及 **Playwright 扩展 E2E** 的覆盖范围与踩坑；便于回归时对照，减少手工偏差。

---

## 一、已归纳的缺陷与根因（运行时日志 + 代码）

| 现象 | 根因（摘要） | 修复方向（实现落在 `chrome-extension/src/content/App.tsx` 等） |
|------|----------------|----------------------------------------------------------------|
| 未整页刷新时连上插件仍无浮标；刷新后才有 | `hasApi:false` 时 `App` 整树 `return null`，划词状态进了 React 但 UI 不渲染；会话就绪后 `readDomSelection()` 瞬时为空 **`setSelection(null)` 清掉**已有选区 | 会话写入路径使用 **`pickSelectionAfterAuth`**：`next = readDomSelection() ?? prev`（sync / microtask / 50ms） |
| 划词过程中 `selectionchange` 刷屏把浮标清掉 | `debounced selectionchange` 在 **`hasSel:false`** 时仍 `setSelection(s)`，站点抖动选区时反复清空 | **仅当 DOM 有有效选区时**再 `setSelection`（positive-only） |
| 第三方页选区读不到 | 仅顶层 `getSelection()`；选区在同源 `iframe` 或时机偏晚 | **`readDomSelection`**：`contentWindow.getSelection()` + iframe 坐标换算；划词结束用 **microtask + 短延迟** 再读 |
| 同一次点击两次读区 | 同时监听 **`mouseup` + `pointerup`** | **只保留 `pointerup`** |
| Options 在后台时网站已连接，切回仍像未连接 | 仅依赖 `storage.onChanged`；页面在后台可能错过或需补拉 | Options：`visibilitychange` + `window.focus` 时 **`applyAuthStateFromStorage`** |
| 网站久挂未刷新点后「连接」无效、用户以为同步失败 | `getSession`/hook 不同步，**静默 return** | `AuthNav`：读不到 `access_token` 时 **文案提示「请先刷新再点连接插件」** |

说明：**网站 postMessage 全链路**（真实 Supabase 会话）未在 E2E 里_mock；E2E 用 **Service Worker 内 `chrome.storage.local.set`** 模拟「连接成功」后的存储与监听器行为。

---

## 二、Playwright 扩展 E2E

### 前置

- 根目录：`npm run build`（Next 生产包，`next start` 宿主页）
- `chrome-extension`：`npm run build` → 生成 **`chrome-extension/dist`**
- 浏览器：`npx playwright install chromium`（使用 Playwright 自带 **Chromium**，`channel: 'chromium'`，与侧载扩展一致）

CI 顺序：**Next build → 扩展 build → `npm run test:e2e`**（见 `.github/workflows/ci.yml`）。

### 涉及文件

| 路径 | 说明 |
|------|------|
| `e2e/extension-fixtures.ts` | `launchPersistentContext` + `--load-extension`、从 SW `evaluate` 写 storage、浮标断言辅助 |
| `e2e/extension-crow-bridge.spec.ts` | 扩展桥接用例（见下表） |
| `public/e2e-extension-host.html` | 顶层划词宿主页 |
| `public/e2e-extension-iframe-inner.html` | **同源 iframe** 内划词（见下文） |

### 用例与手工场景对应

| ID | 用例 | 对应关注点 |
|----|------|------------|
| E2E-EXT-01 | 已写入会话 + 顶层划词 → Shadow 内 `.crow-btn` 可见 | 已连接 + 浮标 |
| E2E-EXT-02 | 清空 storage + 划词 → 有 `#crow-ext-host` 且 Shadow 内 `.crow-btn` **可见** | 未连接仍可解释（公开 `/api/explain`），浮标仍出现 |
| E2E-EXT-03 | 先划词再 `seedCrowAuth` → 浮标仍出现 | **`pickSelectionAfterAuth`（dom ?? prev）** |
| E2E-EXT-04 | iframe 内划词 → 子 frame 内 `#crow-ext-host` + 浮标 | **同源 iframe + all_frames** |
| E2E-EXT-05 | 打开 Options →「插件已连接到你的账号」 | Options UI |

### 常用命令

```bash
# 全套 E2E（含首页 A1 + 扩展）
npm run build --prefix chrome-extension
npm run build
npm run test:e2e
```

```bash
# 仅扩展 5 条（脚本内会先 build 扩展）
npm run test:e2e:ext
```

本地已有 `next start`（例如 `PORT=3107`）时：

`PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3107 npm run test:e2e`

### E2E 实现踩坑（避免再犯）

1. **`locator.evaluate()` 返回 Promise**  
   不能写 `expect(locator.evaluate(...)).toBe(true)`，会得到 **`Promise {}`**。应对方式：先 **`await evaluate`**，或用 **`expect.poll(async () => locator.evaluate(...)).toBe(true)`**（`expectNoCrowFab` 已按后者实现）。

2. **`srcdoc` iframe 与内容脚本**  
   `srcdoc` 子文档常为 **`about:srcdoc`**，不一定命中扩展的 `matches: <all_urls>`，**内容脚本可能不注入**，iframe 内没有 `#crow-ext-host`。  
   **应对**：E2E 宿主页改用 **同源 `src`**，例如 `/e2e-extension-iframe-inner.html`，并等待 `#innerp` 再划词。

---

## 三、与 Phase 2 文档的关系

划词、存储、Options 的**产品结构**仍以 [`phase-2-chrome-extension.md`](./phase-2-chrome-extension.md) 与 `docs/product/chrome-extension.md` 为准；**本节与 E2E 为回归专用**，随划词/连接逻辑变更时请同步改断言或宿主页。
