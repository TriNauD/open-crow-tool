# Chrome 扩展暂停划词开关 — QA

## 0. 本次执行记录

| 时间 | 动作 | 结果 |
|------|------|------|
| 2026-05-11 | `tsc --noEmit`（主应用 + Chrome 扩展） | PASS |
| 2026-05-11 | `npm run lint` | PASS |
| 2026-05-11 | PR [#27](https://github.com/TriNauD/open-crow-tool/pull/27) → merge 到 dev | PASS |
| | 手测最小路径 §0.2 | PENDING（用户验收） |

**手测环境**：`npm run dev`（`http://localhost:3000`）+ Chrome 加载扩展 `dist/`（开发者模式）。

---

## 0.1 自动化测试

**命令**：

```bash
npm run test
npm run lint
cd chrome-extension && npm run build
```

**覆盖**：本次改动为扩展 UI 层（storage 读写 + 条件渲染），不涉及 Web API 契约变更，无新增单测用例。核心逻辑（storage 键读写、`mount()`/`unmount()`）依赖手测验证。

**不能自动化的项**：Chrome 扩展真实加载、toggle 切换后 UI 即时反馈、`storage.onChanged` 跨页面同步、`CROW_CONNECT_EXT` 桥接在关闭状态下仍可用。

---

## 0.2 手测详细步骤（最小路径，必做）

**前置**：Chrome 已加载扩展（`chrome-extension/dist/`）；`npm run dev` 运行中或 Vercel Preview 可访问；扩展已连接账号。

### A. 最小路径

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
   - 若失败：检查 `background/index.ts` 中 storage 读取逻辑

5. **重新开启 toggle → 即时生效（无需刷新）**
   - 操作：在 Popup 中点击 toggle 开启（变绿）
   - 预期：当前页面**无需刷新**，划选文字后橙色按钮立即出现

6. **Options 页面同步**
   - 操作：打开扩展 Options 页面
   - 预期：「划词解释」toggle 与 Popup 状态一致；切换任一页面的 toggle，另一页面实时同步

7. **升级兼容（默认开启）**
   - 操作：在 F12 → Application → `chrome.storage.local` 中删除 `crow_extension_enabled` 键
   - 预期：刷新页面后划词功能正常，Popup/Options 中 toggle 显示为开启

### B. 全量用例

见下方 §3 用例表，A 全绿后按需逐项验证。

### C. 常见卡点速查

| 现象 | 检查 |
|------|------|
| Popup 无 toggle | 扩展是否已重新 `npm run build` 并重载 `dist/` |
| 关闭后仍出现浮动按钮 | `storage.onChanged` 是否触发；`unmount()` 是否执行（F12 → 检查 `#crow-ext-host` 是否存在） |
| 开启后划词无反应 | 确认 `crow_extension_enabled` 不为 `false`；确认已连接（`apiBaseUrl` 非空） |
| 快捷键关不掉 | 确认 `background/index.ts` 已更新；`chrome://extensions` 重新加载扩展 |

---

## 1. 影响域标注

- **需求名称**：Chrome 扩展暂停划词开关
- **风险等级**：**Low**（纯 UI 层 + storage 条件 gate，不改 API 契约、不改鉴权逻辑）

### 涉及模块

| 模块 | 文件 | 改动性质 |
|------|------|---------|
| Storage 层 | `lib/crow-session.ts` | 新增 `CROW_EXTENSION_ENABLED_KEY` + `isExplainEnabled`/`setExplainEnabled` |
| Content script | `content/index.tsx` | `mount()` 受开关 gate + `onChanged` 动态挂载/卸载 |
| Background | `background/index.ts` | 快捷键发送前读 storage gate |
| Popup | `popup/main.tsx` | 新增 toggle UI |
| Options | `options/Options.tsx` | 新增 toggle UI + 状态说明 |

### 不受影响（可跳过回归）
- `/api/explain` 路由（无改动）
- `CROW_CONNECT_EXT` 桥接（不受开关影响）
- 订阅/退订链路
- 笔记本 Web 端增删改查

---

## 2. 测试前置条件

- [ ] Chrome 扩展以开发者模式加载 `chrome-extension/dist/`（`cd chrome-extension && npm run build`）
- [ ] `npm run dev` 或 Vercel Preview 可访问
- [ ] 扩展已连接账号（Options 显示绿点）

---

## 3. 功能测试（新功能）

### TC-01 Popup 显示 toggle（默认开启）

- [ ] **步骤**：点击扩展图标
- [ ] **预期**：「划词解释」行 + 绿色 toggle
- [ ] **结果**：

### TC-02 关闭 toggle → 划词/快捷键不触发

- [ ] **步骤**：关闭 toggle → 划词 + Alt+W
- [ ] **预期**：无浮动按钮、无解释卡片
- [ ] **结果**：

### TC-03 关闭时「连接插件」桥接仍可用

- [ ] **步骤**：toggle 关闭 → 网站点「连接插件」
- [ ] **预期**：Options 仍显示已连接
- [ ] **结果**：

### TC-04 开启 toggle → 即时生效（无需刷新）

- [ ] **步骤**：关闭后重新开启 → 划词
- [ ] **预期**：橙色按钮出现
- [ ] **结果**：

### TC-05 Options 同步

- [ ] **步骤**：在 Popup 和 Options 间切换 toggle
- [ ] **预期**：两处状态实时一致
- [ ] **结果**：

### TC-06 跨标签页同步

- [ ] **步骤**：在标签 A 关闭 toggle → 切到标签 B 划词
- [ ] **预期**：标签 B 也无浮动按钮
- [ ] **结果**：

### TC-07 升级兼容（无键 = 开启）

- [ ] **步骤**：删除 `crow_extension_enabled` 键 → 划词
- [ ] **预期**：功能正常，toggle 显示开启
- [ ] **结果**：

---

## 4. 回归测试（受影响邻域）

### RT-01 划词解释功能正常（开启状态下）

- [ ] **步骤**：toggle 开启 → 划词 → 点橙色按钮 → 解释流式返回
- [ ] **预期**：与改动前行为完全一致
- [ ] **结果**：

### RT-02 存入笔记本正常

- [ ] **步骤**：解释完成后点「存入笔记本」
- [ ] **预期**：变绿成功，网站 `/notebook` 可见
- [ ] **结果**：

---

## 5. 测试结论

| 类型 | 结论 |
|------|------|
| 构建（`tsc` + `lint`） | PASS |
| 功能（§3 TC-01～TC-07） | PENDING（用户验收） |
| 回归（§4 RT-01～RT-02） | PENDING（用户验收） |
| 用户整体验收 | PENDING |

**总结论**：待用户手测通过后标记 **PASS**。
