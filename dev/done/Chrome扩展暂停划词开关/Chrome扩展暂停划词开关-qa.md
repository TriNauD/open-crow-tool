# Chrome 扩展暂停划词开关 — QA

## 0. 本次执行记录

| 时间 | 动作 | 结果 |
|------|------|------|
| 2026-05-11 | `tsc --noEmit`（主应用 + Chrome 扩展） | PASS |
| 2026-05-11 | `npm run lint` | PASS |
| 2026-05-11 | PR [#27](https://github.com/TriNauD/open-crow-tool/pull/27) → merge 到 dev | PASS |
| 2026-05-16 | 合并 `bugfix/ext-explain-without-auth-wesrindo` → `dev`（解释无需连接、僵尸 UI、旧页补注 content） | PASS |
| 2026-05-16 | 用户整体验收（手测最小路径 + 迭代场景） | **PASS**（sign-off） |

**手测环境**：`npm run dev`（`http://localhost:3000`）+ Chrome 加载扩展 `dist/`（开发者模式）。

---

## 0.1 自动化测试

**命令**：

```bash
npm run test
npm run lint
cd chrome-extension && npm run build
```

**覆盖**：以 storage gate、`mount`/`unmount`、background 快捷键 gate 为主；不涉及 Web API 契约变更。核心行为（扩展重载、卸载、旧标签无刷新）依赖手测。

**不能自动化的项**：Chrome 扩展真实加载、toggle 与跨标签同步、`storage.onChanged`、`CROW_CONNECT_EXT`、开发模式重载后旧页注入、`onInstalled` 补注。

---

## 0.2 手测详细步骤（最小路径，必做）

**前置**：Chrome 已加载扩展（`chrome-extension/dist/`）；`npm run dev` 或 Preview 可访问。

### A. 最小路径（开关与连接）

1. **Popup toggle 显示**
   - 操作：点击浏览器工具栏扩展图标
   - 预期：Popup 底部出现「划词解释」行 + 绿色 toggle（默认开启）

2. **关闭 toggle → 划词不触发**
   - 操作：在 Popup 中点击 toggle 关闭（变灰）
   - 预期：任意网页划词后**不出现**橙色浮动按钮
   - 若失败：F12 → Application → `chrome.storage.local` → 确认 `crow_extension_enabled` 为 `false`

3. **关闭状态下「连接插件」仍可用**
   - 操作：toggle 关闭时，打开网站点「连接插件」
   - 预期：扩展 Options 仍显示「已连接」（桥接不受开关影响）

4. **快捷键不触发**
   - 操作：toggle 关闭时，在任意网页选中文字，按 Alt+W（Mac: Ctrl+Shift+W）
   - 预期：**不出现**解释卡片

5. **重新开启 toggle → 即时生效（无需刷新）**
   - 操作：在 Popup 中点击 toggle 开启（变绿）
   - 预期：当前页面**无需刷新**，划选文字后橙色按钮立即出现

6. **Options 页面同步**
   - 操作：打开扩展 Options 页面
   - 预期：「划词解释」toggle 与 Popup 状态一致；切换任一页面的 toggle，另一页面实时同步

7. **升级兼容（默认开启）**
   - 操作：在 F12 → Application → `chrome.storage.local` 中删除 `crow_extension_enabled` 键
   - 预期：刷新页面后划词功能正常，Popup/Options 中 toggle 显示为开启

### A2. 迭代验收（2026-05，用户 sign-off）

8. **未连接也可解释，保存时引导连接**
   - 操作：清除或未配置账号时，在任意页划词 → 点「这是啥？」
   - 预期：流式解释正常；底部为「连接插件后可保存」，点击打开 Options

9. **扩展重载 / 卸载后无僵尸 UI；旧页与开关同步**
   - 操作：`chrome://extensions` 中重载扩展（或移除扩展）；多标签保持打开，切换 toggle
   - 预期：失效后悬浮层消失；重载后**不刷新**旧标签，划词与开关状态一致（旧页能再出悬浮或按关状态隐藏）

### B. 全量用例

见下方 §3 用例表，A + A2 全绿后按需逐项验证。

### C. 常见卡点速查

| 现象 | 检查 |
|------|------|
| Popup 无 toggle | 扩展是否已重新 `npm run build` 并重载 `dist/` |
| 关闭后仍出现浮动按钮 | `storage.onChanged` 是否触发；`unmount()` 是否执行（F12 → 检查 `#crow-ext-host` 是否存在） |
| 开启后划词无反应 | `crow_extension_enabled` 不为 `false`；重载后见 `background` `onInstalled` 是否注入 |
| 快捷键关不掉 | `background/index.ts` 中 storage gate |

---

## 1. 影响域标注

- **需求名称**：Chrome 扩展暂停划词开关（含 2026-05 迭代）
- **风险等级**：**Low**（运行时 gate + 注入补偿；公开 `/api/explain` 行为与站点策略一致）

### 涉及模块

| 模块 | 文件 | 改动性质 |
|------|------|---------|
| Storage 层 | `lib/crow-session.ts` | `CROW_EXTENSION_ENABLED_KEY`、`isExplainEnabled` / `setExplainEnabled` |
| Content script | `content/index.tsx` | gate、`onChanged`、心跳、去重、`mount` 孤立节点处理 |
| Content | `content/App.tsx`、ExplainCard | 未连接时 fallback explain、保存引导 |
| Background | `background/index.ts` | 快捷键 gate、`onInstalled` 向已打开标签补注 content |
| Popup / Options | `popup/main.tsx`、`options/Options.tsx` | toggle UI |

---

## 2. 测试前置条件

- [x] Chrome 扩展以开发者模式加载 `chrome-extension/dist/`
- [x] `npm run dev` 或 Vercel Preview 可访问
- [x] 支持「已连接」与「未连接」两种路径核验

---

## 3. 功能测试（新功能）

### TC-01～TC-07

| 用例 | 结论 |
|------|------|
| TC-01 Popup 显示 toggle | PASS |
| TC-02 关闭 toggle → 划词/快捷键不触发 | PASS |
| TC-03 关闭时「连接插件」桥接仍可用 | PASS |
| TC-04 开启 toggle → 即时生效 | PASS |
| TC-05 Options 同步 | PASS |
| TC-06 跨标签页同步 | PASS |
| TC-07 升级兼容（无键 = 开启） | PASS |

---

## 4. 回归测试（受影响邻域）

| 用例 | 结论 |
|------|------|
| RT-01 划词解释（已连接，开启） | PASS |
| RT-02 存入笔记本 | PASS |

---

## 5. 测试结论

| 类型 | 结论 |
|------|------|
| 构建（`tsc` + `lint` + ext `build`） | PASS |
| 功能（§3） | **PASS** |
| 迭代场景（§0.2 A2） | **PASS** |
| 用户整体验收 | **PASS**（2026-05-16，sign-off） |

**总结论**：**PASS**，已结项。详情见 [`dev/logs/Chrome扩展暂停划词开关-log.md`](../../logs/Chrome扩展暂停划词开关-log.md)。
