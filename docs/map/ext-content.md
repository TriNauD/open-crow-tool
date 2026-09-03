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
- **根治 = DOM 锚定（`anchored` 模式）**：气泡 `position:absolute` 挂进**选区所在的滚动容器**（没有内部容器则退化挂 `body`），用**宿主局部坐标**（容器级）或**文档坐标**（页面级）定位，滚动时浏览器把气泡和文字当同一份内容一起合成滚动，**JS 完全不参与** → 相位差归零。锚定模式下**滚动期间一律不写 DOM**（`scroll` 只打 `lastScrollAt`，静默 140ms 后才低频校验，纠 reflow 偏移）；滚动中一旦写坐标，根治效果立刻失效、晃动原样回来。
- **容器级锚定是关键补丁**：AI 对话站（ds / chatgpt）的消息区是独立 `overflow:auto` 容器，划词在消息里、气泡挂 `body` 不跟它滚 → 旧逻辑把「祖先有内部滚动容器」当拒绝条件直接回退 `fixed`，而 `fixed` 在合成器滚动站点仍有相位差＝还是晃。改法：锚定宿主向上找第一个内部可滚动容器，气泡挂进去随容器一起滚（容器内 `position:static` 时由组件补 `position:relative` 创建定位上下文，卸载还原）。x.com（无内部容器→挂 body）已验证有效，ds/chatgpt 走容器级分支。
- 锚定只在「文档结构允许」时成立，否则回退 `fixed`：`body`/`html` 不能创建 containing block、祖先不能有 fixed / sticky、选区必须与浮标同文档（跨 frame 会 double-offset）。**祖先的 transform / filter / will-change / contain 不再阻止锚定**（见下）。判定 + 宿主选择 + 坐标换算见 `floating-anchor.ts`，`reason`（含 `scroll-host-<tag>`）打进 console（`[crow-anchor]`），真机排查先看它。
- **祖先的 transform / filter / perspective / will-change / contain 一律不阻止锚定**（曾阻止过，结果 x.com 100% 回退、锚定形同虚设）。气泡 `absolute` 挂在 body 下，**不是这些祖先的后代**——它们的 containing block、裁剪、合成层效应统统管不到气泡；文字位置由 `getBoundingClientRect()` 给出（已含变换），与**静态**变换完全兼容。旧版 `will-change` 翻车是**气泡自己**被推上独立层 + fixed + 每帧 JS 写坐标三条件叠加，与此不同源，别再套用那条教训。
- **动态变换（虚拟滚动 / transform 模拟滚动）靠运行时自检降级，不靠挂载时一刀切**：静止期低频比较「气泡−文字的相对偏移 gap」与「文字的**文档纵坐标** textDocY」。**判据是文字自己有没有挪窝**——`textDocY` 也变了是 reflow（图片懒加载撑开高度 / 折叠展开），重新落位即可、基准跟着更新；`textDocY` 没变而 gap 漂了，才是气泡没跟着文字走 → 降级 `fixed`。**绝不能按漂移大小判定**：x.com 滚动时懒加载图片能把文字顶下几百像素，按大小判会把正常 reflow 全误杀成脱钩。降级单向（anchored → fixed，不反向），逻辑在 `FloatingButton.tsx` 的 `verify()`。
- 回退的 `fixed` 模式仍是 **rAF（兜底 transform 模拟滚动）＋ scroll 同步（优化真实滚动）双路**：大量 SPA / AI 对话站用 transform 或容器滚动模拟滚动、根本不派发 `window` 的 `scroll` 事件，纯 scroll 监听会完全失效、气泡冻结，必须靠每帧 rAF 兜底。
- **不要加 `will-change: transform`**：它把气泡推上独立合成层，而选区文字在主文档层，两者连续滚动时亚像素栅格对齐差出零点几像素 → 反而**制造**「气泡相对文字轻微上下晃」。不强制合成层时两者同层、栅格化节奏一致，更稳。

## 相关测试 / E2E

- 单测：`__tests__/normalize-note-input.test.ts`、`__tests__/floating-anchor.test.ts`（定位模式判定分支；Vitest 跑在 node 环境，用最小 DOM 桩驱动）
- E2E：`e2e/extension-crow-bridge.spec.ts` + `e2e/extension-fixtures.ts`（跑前先构建扩展，见 `npm run test:e2e:ext`）。**EXT-11 / 12 / 13 是浮标定位的回归闸门**：
  - **EXT-11** 断言平滑滚动期间浮标 style **零写入**——谁把坐标写回「滚动中更新」，这条就红（根治合成器相位差的硬证据；先用 `position==='absolute'` 自证跑在锚定模式，排除「回退了却恰好零写入」的假阳性）。
  - **EXT-12** 断言脱钩自动降级：只挪气泡不挪文字 → 必须降到 `fixed`。
  - **EXT-13** 断言 reflow 不误判：内容上方撑开 180px 让文字真的移窝 → 必须**只纠偏不降级**，且气泡重新贴回文字。
  - **EXT-14** 断言**容器级锚定**：在 `#scroll-box` 独立滚动容器内划词，气泡必须是该容器的后代（而非 body 直子）、`position:absolute`、容器平滑滚动期间 JS 几乎零写入（≤1 次）、且滚前滚后气泡相对文字的位置恒定（gapDrift<2）。这是 ds / chatgpt 类「消息区是独立滚动容器」站点的根治证据——旧逻辑把「祖先有内部滚动容器」当拒绝条件直接回退 fixed，而 fixed 在合成器滚动站点仍有相位差。
- E2E 输出目录别用默认的 `test-results/`——Playwright 启动会清空它，chromium profile 一次几千个文件，沙箱批量删除保护会直接把测试拦下。换 `--output=test-results-ext`（已加 `.gitignore` 通配 `/test-results*/`）。
