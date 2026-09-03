# 扩展 · 划词内容脚本（`chrome-extension/src/content/`）

注入页面的 content script（React 18 + Shadow DOM），扩展最大单体。

## 文件清单

| 文件 | 职责 |
|---|---|
| `chrome-extension/src/content/index.tsx` | 注入入口：mount React root；window 标志位防重复初始化（Chrome 自动注入与 background 补注入可能叠加） |
| `chrome-extension/src/content/App.tsx` | 主组件：选区监听 → 浮标 / 卡片状态机；接入 auth 广播与开关；未连接时 fallback 公开 explain 端点（env `VITE_PUBLIC_SITE_URL` 或 dev.crowknows.tech） |
| `chrome-extension/src/content/FloatingButton.tsx` | 划词后浮标按钮：`position: fixed` + **rAF 循环 + scroll 同步双路**每帧/每滚动读选区 Range 屏幕坐标直接写 DOM（ref 改 `transform:translate`，走合成层、亚像素对齐，零 React 重渲染＝零抖动）；rAF 兜底「不派发 scroll 事件的 transform 滚动」、scroll 同步消除 rAF 慢半帧的上下晃动；气泡与词「锁在一起」一起移动；`data-crow-fab` 让避让检测排除自身，避免自遮挡导致的上下横跳 |
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
- 浮标**必须**带 `data-crow-fab` 且 `isOwnUi()` 要认它：浮标是亮 DOM 里的 `position:fixed` + 最大 z-index，若避让检测不把它当自己人，会永远判定「上方被占 → 翻下方 → 下方被占 → 翻上方」每 400ms 横跳（普通网页上下跳动的根因）。零抖动**并非靠坐标定死**，而是靠：**rAF 循环 + scroll 同步双路每帧/每滚动读选区 Range 屏幕坐标、ref 直接写 `transform:translate`（fixed + 合成层、亚像素对齐，零 React 重渲染）**，气泡与被划的词相对静止、锁在一起，随页面滚动一起移动，不会相对词漂移或脱钩；换词靠 App 用新 `key` 重挂载。**关键坑：跟随绝不能「只」依赖 `scroll` 事件去触发更新**——大量 SPA / AI 对话站用 transform 或容器滚动模拟滚动、根本不派发 `window` 的 `scroll` 事件（纯 scroll 监听会完全失效、气泡冻结），必须靠每帧 rAF 轮询选区坐标兜底；但真实滚动站点会派发 scroll 且发生在「滚动量应用之后、rAF 之前」，可在 scroll 回调里同步读坐标写 transform，让气泡与本帧滚动同帧落位、消除 rAF 慢半帧的上下晃动。即 **rAF（兜底 transform 滚动）＋ scroll 同步（优化真实滚动）双路**。旧的 CSS Anchor Positioning（`anchor-name` + MutationObserver）方案已弃用：宿主元素被页面重渲染会抹掉内联样式，导致「掉回文档流」闪烁帧。

## 相关测试 / E2E

- 单测：`__tests__/normalize-note-input.test.ts`
- E2E：`e2e/extension-crow-bridge.spec.ts` + `e2e/extension-fixtures.ts`（跑前先构建扩展，见 `npm run test:e2e:ext`）
