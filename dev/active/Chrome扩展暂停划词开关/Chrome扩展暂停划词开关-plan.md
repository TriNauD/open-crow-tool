# Chrome 扩展暂停划词开关 — Plan

> 立项日期：2026-04-29  
> **开工前提**：`Chrome扩展插件内refresh` 相关 PR 合并入 `dev`（或团队约定的基线）后，从最新 `dev` 切分支实现本需求。

## [PM] 功能与验收

### 用户可见

- **Popup**：显著位置提供「划词解释：开 / 关」（或等价文案），切换后立即生效（当前标签无需整页刷新为佳）。  
- **Options**：同步展示同一状态 + 简短说明（关时仍可在网站「连接插件」）。  
- **关**：任意网页上 **不出现** 划词浮层、**不**因划词/快捷键进入解释流。  
- **开**：与现状一致。  
- **默认**：新安装与升级后为 **开**。

### 明确不做（本期）

- 不为「关」状态隐藏扩展图标或改浏览器权限。  
- 不改变 `host_permissions` / content_scripts 在 manifest 层面的注册范围（仍由运行时逻辑 gate；若后续为性能再议）。

---

## [TL] 技术要点

### 存储

- 建议 **`chrome.storage.local`** 键：`crow_extension_enabled`（`boolean`，缺省视为 `true`）。  
- 与现有 `crow-session` 键并存；**不写 sync**，避免跨设备误解（可选：若希望跟随 Google 账号再议）。

### Content script（`index.tsx` / `App`）

- **桥接**：`CROW_CONNECT_EXT` 监听 **始终注册**（模块顶层，与 `crowNative` 策略一致）。  
- **划词 UI**：仅在 `crow_extension_enabled !== false` 时 `mount()` 内创建 shadow root + `<App />`。  
- **storage.onChanged**：监听上述键，**动态**挂载/卸载 App（或挂载空占位），避免必须刷新页面。  
- **Alt+W / 快捷键**：`background` → `content` 发 `CROW_EXPLAIN` 时，content 侧若已关则 **直接 return**（或在 background 读 storage 后不发——二选一，优先 content 单点拦截以降低 background 读 storage 频率）。

### Popup / Options

- 读取并回写同一键； toggling 时 `chrome.storage.local.set`。  
- 文案避免「禁用扩展」易与系统层混淆，可用「暂停划词解释」。

### 兼容

- 无键：`true`。  
- 与 **refresh / 双构建** 无冲突。

---

## [QA] 摘要

- 开关关闭：外站选词无按钮；快捷键无卡片。  
- 开关关闭：Crow 站点仍可「连接插件」并成功写 storage。  
- 开关切换：无需刷新即可验证（或文档接受「需刷新」若实现受限）。  
- 升级自旧版：默认开。

---

## [Decision]

- 立项通过；**实现顺序**在 session refresh 之后。

## 分支（待开工时）

```text
fea/chrome-ext-pause-toggle-<owner>
```
