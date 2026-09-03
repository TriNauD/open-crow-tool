# 扩展 · 划词内容脚本（`chrome-extension/src/content/`）

注入页面的 content script（React 18 + Shadow DOM），扩展最大单体。

## 文件清单

| 文件 | 职责 |
|---|---|
| `chrome-extension/src/content/index.tsx` | 注入入口：mount React root；window 标志位防重复初始化（Chrome 自动注入与 background 补注入可能叠加） |
| `chrome-extension/src/content/App.tsx` | 主组件：选区监听 → 浮标 / 卡片状态机；接入 auth 广播与开关；未连接时 fallback 公开 explain 端点（env `VITE_PUBLIC_SITE_URL` 或 dev.crowknows.tech） |
| `chrome-extension/src/content/FloatingButton.tsx` | 划词后浮标按钮，**双模式定位**（判据见下条）：`anchored` 优先（`position:absolute` 挂 body 文档流 + 文档坐标，滚动期零 JS 干预）/ `fixed` 回退（rAF 循环 + scroll 同步双路每帧跟随）；两种模式都用 ref 直写 DOM 的 `transform:translate`（亚像素对齐，零 React 重渲染＝零抖动）；`data-crow-fab` 让避让检测排除自身，避免自遮挡导致的上下横跳 |
| `chrome-extension/src/content/floating-anchor.ts` | 浮标定位模式判定（纯逻辑，Vitest 直测）：`resolveAnchorMode()` 判断能否 DOM 锚定、`viewportToDocument()` 视口坐标转文档坐标 |
| `chrome-extension/src/content/floating-placement.ts` | 浮标避让纯逻辑：宿主页 top-layer 弹层（ChatGPT 气泡等）压不住 z-index，检测选区上/下哪侧空旷来落位；`isOwnUi()` 必须认亮 DOM 的 `button[data-crow-fab]`，否则浮标会判定「自己挡住自己」 |
| `chrome-extension/src/content/ExplainCard.tsx` | 解释卡：流式渲染、保存笔记（查重）、内嵌登录入口、追问子卡片（递归 `depth`；图钉/拖拽仅主卡有效，子卡片无图钉但可折叠自身——折叠徽章对所有子卡常显；折叠仅手动；出子卡片后父卡 body 自动跟随滚到底，向上滚即停） |
| `chrome-extension/src/content/useStreamExplain.ts` | 扩展版流式 explain（Web 版 `hooks/useStreamExplain.ts` 的平行实现） |
| `chrome-extension/src/content/normalize-note-input.ts` | 查重规范化（Web 版 `lib/notes/normalize-input.ts` 平行实现） |
| `chrome-extension/src/content/surrounding-text.ts` | 选区前后文截取（B-2，各 ≤120 字符，中间【…】占位；失败静默降级） |
| `chrome-extension/src/content/crow-auth-broadcast.ts` | 接收网页 postMessage 广播的会话 → 写 chrome.storage；React 未就绪时缓存一条防丢 |
| `chrome-extension/src/content/styles.ts` | Shadow DOM 内样式 |

## 接缝

- 卡片 → API：`POST /api/explain`（流式）与 `POST /api/notes`（Bearer JWT，apiBaseUrl 来自会话）。
- 会话来源双通道：网页广播（上表）/ 扩展内登录（见 [ext-platform.md](./ext-platform.md)）。
- 纯逻辑（`chrome-extension/src/content/normalize-note-input.ts`、`chrome-extension/src/content/surrounding-text.ts`）被根目录 Vitest 直接测试。

## 坑

- MV3 扩展 reload 后旧注入脚本的 chrome.* 调用会抛 "Extension context invalidated"——统一用 `chrome-extension/src/lib/extension-context.ts` 吞错，不要自己裸 try/catch。
- 初始化幂等靠 `chrome-extension/src/content/index.tsx` 的 window 标志位，别删。
- 样式只能动 `chrome-extension/src/content/styles.ts`（Shadow DOM 隔离了页面全局 CSS）。
- ExplainCard 父卡片 body 的滚动跟随（`followBottomRef`）必须用 ResizeObserver 观察子卡片包裹层 `.crow-child-card`——观察 body 自身感知不到内容增长（body 高度固定，只有 scrollHeight 在变）。Web 版 `components/ExplanationCard.tsx` 无折叠/跟随逻辑（页面自然流），改这块不用双侧同步。
- 浮标**必须**带 `data-crow-fab` 且 `isOwnUi()` 要认它：浮标是亮 DOM 里的 `position:fixed`/`absolute` + 最大 z-index，若避让检测不把它当自己人，会永远判定「上方被占 → 翻下方 → 下方被占 → 翻上方」每 400ms 横跳（普通网页上下跳动的根因）。换词靠 App 用新 `key` 重挂载。
- **滚动晃动的根因是合成器（GPU）滚动与主线程读坐标的相位差，不是逻辑 bug**：x.com 这类超重 SPA 的滚动由合成器线程驱动，主线程 `getBoundingClientRect()` 读到的坐标**滞后于**视觉滚动，「每帧读坐标 → 写 transform」必然把滞后的坐标盖到**已滚到位**的内容上 → 气泡相对文字慢半帧＝晃。真机日志佐证过逻辑层没问题（`mountSeq` 恒 1、`gap` 恒 -38、`drift` 恒 0）。这是 JS 跟随方案的固有天花板，调 rAF 时序 / scroll 同步 / will-change 都跨不过去。
- **根治 = DOM 锚定（`anchored` 模式）**：气泡 `position:absolute` 挂进 `document.body` 文档流、用**文档坐标**定位，滚动时浏览器把气泡和文字当同一份内容一起合成滚动，**JS 完全不参与** → 相位差归零。锚定模式下**滚动期间一律不写 DOM**（`scroll` 只打 `lastScrollAt`，静默 140ms 后才低频校验，纠 reflow 偏移）；滚动中一旦写坐标，根治效果立刻失效、晃动原样回来。
- 锚定只在「文档结构纯净」时成立，否则回退 `fixed`：`body`/`html` 不能创建 containing block、祖先不能有 fixed / sticky / 内部可滚动容器 / 独立渲染层（transform · filter · perspective · backdrop-filter · will-change · contain: paint|layout|strict|content）、选区必须与浮标同文档（跨 frame 会 double-offset）。判定见 `floating-anchor.ts`，`reason` 打进 console（`[crow-anchor]`），真机排查先看它。
- 判定只认**独立渲染层**，**不认** `position: relative`——现代页面大量 relative 祖先，误排除会让 DOM 锚定几乎永不生效。
- 回退的 `fixed` 模式仍是 **rAF（兜底 transform 模拟滚动）＋ scroll 同步（优化真实滚动）双路**：大量 SPA / AI 对话站用 transform 或容器滚动模拟滚动、根本不派发 `window` 的 `scroll` 事件，纯 scroll 监听会完全失效、气泡冻结，必须靠每帧 rAF 兜底。
- **不要加 `will-change: transform`**：它把气泡推上独立合成层，而选区文字在主文档层，两者连续滚动时亚像素栅格对齐差出零点几像素 → 反而**制造**「气泡相对文字轻微上下晃」。不强制合成层时两者同层、栅格化节奏一致，更稳。

## 相关测试 / E2E

- 单测：`__tests__/normalize-note-input.test.ts`、`__tests__/floating-anchor.test.ts`（定位模式判定分支；Vitest 跑在 node 环境，用最小 DOM 桩驱动）
- E2E：`e2e/extension-crow-bridge.spec.ts` + `e2e/extension-fixtures.ts`（跑前先构建扩展，见 `npm run test:e2e:ext`）。**EXT-11 是滚动晃动的回归闸门**：断言平滑滚动期间浮标 style **零写入**——谁把坐标写回「滚动中更新」，这条就会红。
