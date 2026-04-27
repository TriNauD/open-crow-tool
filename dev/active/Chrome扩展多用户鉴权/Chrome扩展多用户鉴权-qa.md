# Chrome 扩展多用户鉴权 — QA

## 0. 本次执行记录

| 时间 | 动作 | 结果 |
|------|------|------|
| 2026-04-27 | `chrome-extension npm run build` | PASS |
| 2026-04-27 | 连接插件 + Options 与 storage 一致（含旧 prod `apiBaseUrl` → localhost 切换） | **PASS（用户确认）** |
| 2026-04-27 | Bugfix 与根因归档 | 见 `dev/logs/Chrome扩展多用户鉴权-log.md`（BF-1～BF-4） |
| 2026-04-27 | Web 端 `next build` / `next lint`、其余 TC/RT 全量 | **待正式验收时补全**（可选：发布前在 Preview 再跑一遍） |

**手测环境**：`npm run dev`（`http://localhost:3000`）+ Chrome 加载扩展 `dist/`（开发者模式）。

**重要**：连接桥接在 `chrome-extension/src/content/index.tsx` 顶层，**不在** `App.tsx`（自站点不挂载 `App` 时仍须能收消息）。详见上述 log 中 BF-1、BF-3。

---

## 1. 影响域标注

- **需求名称**：Chrome 扩展多用户鉴权
- **风险等级**：**Medium**（改动扩展存笔记鉴权路径 + Web 端导航新增按钮；不改 API 契约）

### 涉及模块

| 模块 | 文件 | 改动性质 |
|------|------|---------|
| Web 导航 | `components/AuthNav.tsx` | 新增「连接插件」+ 乐观 UI |
| 扩展 content script | `chrome-extension/src/content/index.tsx` | **顶层** `CROW_CONNECT_EXT` 桥接 + `samePageOrigin` |
| 扩展 content UI | `chrome-extension/src/content/App.tsx` | 划词/解释（不承载连接监听器） |
| 扩展 Options | `chrome-extension/src/options/Options.tsx` | 状态界面 + 手动备用区 |
| 扩展 ExplainCard | `chrome-extension/src/content/ExplainCard.tsx` | 401/403 精确错误处理 |
| 扩展 Popup | `chrome-extension/src/popup/main.tsx` | 用 `accessToken` 判断已配置 |

### 不受影响（可跳过回归）
- `/api/explain` 路由（无改动）
- 订阅/退订链路
- 笔记本 Web 端增删改查（后端 API 无改动）

---

## 2. 测试前置条件

- [ ] Chrome 扩展以开发者模式加载 `chrome-extension/dist/`（或 `npm run build` 后重载）
- [ ] `npm run dev` 或 Vercel Preview 可访问
- [ ] 已有测试账号，能正常登录并在 Web 端存笔记
- [ ] 准备「旧版配置」：`chrome.storage.sync` 中有 `adminSecret` 而无 `accessToken`（用于测 TC-06）

---

## 3. 功能测试（新功能）

**快速手测顺序建议**：TC-01 → TC-02 → TC-03 → TC-04 → TC-05 → TC-06 → TC-07

---

### TC-01 一键连接：网站点按钮 → 扩展变为「已连接」

- [ ] **步骤**：
  1. 在 Chrome 加载扩展，初始状态 `chrome.storage.sync` 无 `accessToken`（或先清空）
  2. 在 Web 端用测试账号登录
  3. 导航栏可见「**连接插件**」按钮（已登录时才显示）
  4. 点击「连接插件」
- [ ] **预期**：
  - 按钮在约 1 秒内变绿显示「✓ 插件已连接」，4 秒后恢复原文
  - 打开扩展 Options → 状态区显示「插件已连接到你的账号」+ 绿点 + 站点地址
  - `chrome.storage.sync` 中存有 `accessToken`（非空）和 `apiBaseUrl`
- [ ] **结果**：

---

### TC-02 无 token 时点「存入笔记本」→ 精确提示去连接

- [ ] **步骤**：
  1. 确认扩展 `chrome.storage.sync` 无 `accessToken`（清空或初始状态）
  2. 在任意网页划词 → 等解释完成 → 点「存入笔记本」
- [ ] **预期**：
  - 显示「⚠️ 登录已过期，请回网站点「连接插件」」
  - 其中「连接插件」为橙色可点链接，点击后跳转到 Web 站点
  - **不**显示「请检查插件设置」等旧文案
- [ ] **结果**：

---

### TC-03 错误/伪造 token → 401 精确提示

- [ ] **步骤**：
  1. 手动在 Options 备用表单填入无效 token（如 `bad-token`）+ 正确的 `apiBaseUrl`，保存
  2. 划词 → 等解释完成 → 点「存入笔记本」
- [ ] **预期**：
  - API 返回 401
  - 显示「⚠️ 登录已过期，请回网站点「连接插件」」+ 橙色跳转链接
- [ ] **结果**：

---

### TC-04 正常 token → 存笔记成功，Web 端同账号可见

- [ ] **步骤**：
  1. 完成 TC-01（已连接）
  2. 在任意网页划词 → 等解释完成 → 点「存入笔记本」
  3. 打开 Web 端 `/notebook`（同账号）
- [ ] **预期**：
  - 扩展卡片按钮变绿「✓ 已存入笔记本」
  - `/notebook` 中该笔记可见，`source` 为 `chrome_extension`
- [ ] **结果**：

---

### TC-05 token 过期（401）→ 重新连接后可恢复

- [ ] **步骤**：
  1. 手动改 `accessToken` 为过期的旧 token
  2. 划词 → 点「存入笔记本」→ 确认出现「⚠️ 登录已过期」提示
  3. 点提示中链接跳转到网站 → 重新点「连接插件」→ 再次划词存笔记
- [ ] **预期**：
  - 第二步报「过期」
  - 第三步再次存笔记成功
- [ ] **结果**：

---

### TC-06 旧版 `adminSecret` 配置 → 提示需重新授权

- [ ] **步骤**：
  1. 通过开发者工具直接写 `chrome.storage.sync`：`{ adminSecret: 'abc', apiBaseUrl: '...' }`（无 `accessToken`）
  2. 打开扩展 Options
- [ ] **预期**：
  - 状态区显示「插件尚未连接」（红点）
  - 主界面文案提示：「检测到旧版配置，请在网站登录后点「连接插件」重新授权」
- [ ] **结果**：

---

### TC-07 手动备用表单（自部署用户）

- [ ] **步骤**：
  1. 打开扩展 Options → 点「▼ 手动填写（自部署 / 开发者）」
  2. 填入正确 `apiBaseUrl` 和有效 `accessToken` → 保存
- [ ] **预期**：
  - 表单保存成功
  - 主区域状态变为「已连接」+ 绿点
  - 划词存笔记可正常使用
- [ ] **结果**：

---

## 4. 回归测试（受影响邻域）

### RT-01 「连接插件」按钮仅已登录时出现

- [ ] **步骤**：未登录状态打开 Web 端，检查导航栏
- [ ] **预期**：仅显示「登录」「注册」，无「连接插件」按钮
- [ ] **结果**：

### RT-02 Web 端正常存笔记功能不受影响

- [ ] **步骤**：已登录 → 在首页输入词 → 等解释 → 点「存到笔记本」（Web 端流程）
- [ ] **预期**：存笔记成功，`/notebook` 可见，与改动前行为完全一致
- [ ] **结果**：

### RT-03 扩展划词解释功能不受影响

- [ ] **步骤**：划词 → 点橙色按钮 → 流式解释正常出现
- [ ] **预期**：解释流程与之前一致，无额外权限弹窗或报错
- [ ] **结果**：

---

## 5. 测试结论

| 类型 | 结论 |
|------|------|
| 构建（`npm run build`） | PASS |
| 核心问题修复（网站已连接、扩展仍未连接 + 点连接无反应） | **PASS（2026-04-27 用户确认）**；根因见 `dev/logs/Chrome扩展多用户鉴权-log.md` |
| 浏览器全量用例（TC-01～TC-07、RT-01～RT-03） | **留待**最终验收或发布前 Preview 全跑 |

**总结论（当前）**：**核心链路可验收**；全量用例与 `next build/lint` 可在合并前或发版前一次性补完并在此表更新为 **PASS**。

---

## 6. 遗留 / 观察（非阻塞）

- `access_token` 约 1 小时过期，无法静默续期；过期后用户需手动回网站重新连接——已在 Options 文案和 ExplainCard 错误提示中明确说明，用户路径清晰，当前阶段可接受。
- 小屏上「连接插件」与邮箱同一行，布局拥挤时可再优化为折叠菜单，不阻塞。  
- postMessage 依赖 content script 在站点页注入；极端权限场景见 TC-01。
