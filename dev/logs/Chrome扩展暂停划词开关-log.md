# Chrome 扩展暂停划词开关 — 结项与迭代记录

> 归档目录：[Chrome扩展暂停划词开关](../done/Chrome扩展暂停划词开关/) — 功能首包 PR [#27](https://github.com/TriNauD/open-crow-tool/pull/27) 已先期合入 `dev`。  
> **结项日期**：2026-05-16（用户整体验收 sign-off）

## 结项摘要

- Popup / Options 共用 `crow_extension_enabled`（缺省开启），`storage.onChanged` 动态 mount/unmount 划词 UI；关闭时 background 不转发解释快捷键。
- 验收后合并迭代分支 `bugfix/ext-explain-without-auth-wesrindo`（fast-forward 入 `dev`）：未连接账号亦可查看公开 `/api/explain`；仅「存入笔记本」引导连接；扩展重载/卸载场景下清除僵尸 UI；`onInstalled` 向已打开标签页补注 content script，保证旧页与开关实时同步且无需刷新。

---

## BF-1：扩展重载后旧标签页残留僵尸悬浮窗（2026-05-16）

- **现象**：仅检查 `chrome.runtime.id` 不足以在部分场景下摘除失效 context 的 DOM。
- **根因**：MV3 重载后旧 content script 的 React 树可仍存在。
- **涉及文件**：`chrome-extension/src/content/index.tsx`（心跳 + `unmount`）、`mount()` 孤立 `#crow-ext-host` 清理。
- **验证**：重载扩展后旧页约 1s 内悬浮层消失；新开/再挂载正常。

---

## BF-2：扩展卸载后当前页仍可划词出悬浮（2026-05-16）

- **现象**：移除扩展后未刷新页面仍出现悬浮按钮。
- **根因**：卸载后 `chrome.runtime.id` 可能仍保留旧字符串，同步检测失效。
- **涉及文件**：`chrome-extension/src/content/index.tsx`（心跳内 `chrome.storage.local.get` 回调校验 `lastError`）。
- **验证**：卸载扩展后约 1s 内 UI 清除。

---

## BF-3：扩展重载后旧网页需整页刷新才再出悬浮（2026-05-16）

- **现象**：开发模式重载扩展后，已打开标签页不再注入新 content script，开关无法作用。
- **根因**：Chrome 对「已打开页」不保证在 reload 后重新注入声明式 content script。
- **涉及文件**：`chrome-extension/src/background/index.ts`（`onInstalled` + `scripting.executeScript` 按 manifest 路径注入）、`content/index.tsx`（`data-crow-cs-init` 去重 + `unmount` 清标志）。
- **验证**：重载扩展后不刷新旧标签，开/关 toggle 与划词行为与预期一致。

---

## 功能增补（同期合入，非独立 BF）

- **未连接也可解释**：`App.tsx` / `ExplainCard.tsx` 使用公开站点 `apiBaseUrl` 调 `/api/explain`；保存笔记前提示「连接插件后可保存」。

---

## 发布与回归提示

- 扩展包：`cd chrome-extension && npm run build`，在 `chrome://extensions` 加载 `dist/`。
- 回归：见 `dev/done/Chrome扩展暂停划词开关/Chrome扩展暂停划词开关-qa.md` 最小路径；手测已按用户 sign-off 结论记 **PASS**。
