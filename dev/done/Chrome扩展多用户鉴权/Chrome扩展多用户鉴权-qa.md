# Chrome 扩展多用户鉴权 — QA

## 0. 本次执行记录

| 时间 | 动作 | 结果 |
|------|------|------|
| 2026-04-27 | `chrome-extension npm run build` | PASS |
| 2026-04-27 | 连接插件 + Options 与 storage 一致（含旧 prod `apiBaseUrl` → localhost 切换） | **PASS（用户确认）** |
| 2026-04-27 | Bugfix 与根因归档 | 见 `dev/logs/Chrome扩展多用户鉴权-log.md`（BF-1～BF-5） |
| 2026-04-27 | `npm run test`（Vitest）+ 手测最小路径 + 用户**整体验收通过** | **PASS** |

**手测环境**：`npm run dev`（`http://localhost:3000`）+ Chrome 加载扩展 `dist/`（开发者模式）。

**重要**：连接桥接在 `chrome-extension/src/content/index.tsx` 顶层，**不在** `App.tsx`（自站点不挂载 `App` 时仍须能收消息）。详见上述 log 中 BF-1、BF-3。

---

## 0.1 自动化测试（减少重复手测）

**目的**：锁定 **CORS 含 `Authorization`** 与 **`samePageOrigin` 逻辑**，避免回归时忘改 `cors.ts` 或桥接校验。

**命令**（仓库根目录，需已 `npm ci` / `npm install`）：

```bash
npm run test
```

**覆盖**（Vitest，`__tests__/*.test.ts`）：

| 文件 | 断言 |
|------|------|
| `__tests__/cors.test.ts` | `corsHeaders` 的 `Access-Control-Allow-Headers` 含 `Authorization`；`handleOptions()` 响应头一致 |
| `__tests__/same-page-origin.test.ts` | 同源/不同端口/非法 URL 等 |

**不能自动化、仍需手测/Preview 的项**：真实浏览器里 `chrome.storage.sync`、`postMessage` 全链、划词 → `POST /api/notes` 与生产部署后的 CORS 行为。发版后至少在 **Preview 或生产** 用下面「0.2」**最小路径**走一遍即可。

---

## 0.2 手测详细步骤（最小路径 + 全量可选项）

### A. 最小路径（发版/改扩展后 10 分钟内，建议必做）

**前置**：本机或 Preview 上 Web 与扩展指向**同一** `apiBaseUrl` 环境；若修的是 **CORS**，线上必须已部署含 `lib/utils/cors.ts` 的 Web 版本。

1. 根目录 `npm run test` 与 `npm run build` 通过；`cd chrome-extension && npm run build` 通过。  
2. `chrome://extensions` → 开发者模式开 → **「这是啥？」→ 重新加载**（或删除后重载 `dist`）。  
3. **清空扩展数据（可选、模拟干净用户）**：打开扩展**选项**页，F12 打开该页的 Console，执行 `chrome.storage.sync.clear(() => location.reload())`（会清掉本扩展 sync 全部键，慎用）。不清空也可测「覆盖旧 prod」场景。  
4. 浏览器打开与扩展将使用的站点（如 `https://你的站` 或 `http://localhost:3000`），**登录**同一账号。  
5. 导航栏点 **「连接插件」**（约 4 秒内可显示「✓ 插件已连接」类反馈）。再打开 **扩展 → 设置**，应看到 **已连接** 与正确 **API 地址**。若否，看 `dev/logs/Chrome扩展多用户鉴权-log.md` 中 BF-3 场景。  
6. 新开标签打开 **任意普通网页**（如新闻站），**划词** → 等解释出字 → 点 **「存入笔记本」**。应成功变绿，且到网站 **笔记本页** 能看到新记录。若失败，查 Network 是否 **CORS**（`POST /api/notes` 为 failed）或 **401**（回站点重新连接）。  
7. 若第 6 步失败，在 **被测网页** 上 F12 → **Network** → 筛选 `api/notes`，看 **预检 OPTIONS** 响应头里 `access-control-allow-headers` 是否含 **`authorization`**（大小写浏览器可能小写显示）。

### B. 全量用例（本文件 §3 的 TC-01～TC-07、§4 的 RT）

在 A 全绿后，按 §3/§4 表逐项勾选；**不必每次发版都跑全量**，大改鉴权/扩展或发 **major** 前跑一遍即可。

### C. 常见卡点速查

| 现象 | 检查 |
|------|------|
| 点「连接」无反应 | 扩展是否已 **重新加载**、页面是否已 **刷新**；`data-crow-native` 见 log BF-1。 |
| 网站绿、设置仍未连接 | 见 log **BF-3**；或旧扩展未重载。 |
| 能连上但存笔记失败 | 见 log **BF-5**；Web 是否已部署新 `cors.ts`；Network 里 CORS/401。 |
| 文案仍是「请检查插件设置」 | 旧 **dist**；`chrome-extension` 重新 `npm run build` 并重载扩展。 |

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
| 构建（根目录 + `chrome-extension`） | PASS |
| 自动化（`npm run test`） | PASS |
| 核心链路与 Bugfix（连接、storage、CORS 存笔记） | **PASS**；根因见 `dev/logs/Chrome扩展多用户鉴权-log.md` |
| 用户整体验收（含手测清单） | **PASS（2026-04-27）** |

**总结论**：**PASS，结项**。余下 §3/§4 未逐条勾选的 TC/RT 可作为后续大版本发布前的可选回归；不影响本需求结项。

---

## 6. 遗留 / 观察（非阻塞）

- `access_token` 约 1 小时过期，无法静默续期；过期后用户需手动回网站重新连接——已在 Options 文案和 ExplainCard 错误提示中明确说明，用户路径清晰，当前阶段可接受。
- 小屏上「连接插件」与邮箱同一行，布局拥挤时可再优化为折叠菜单，不阻塞。  
- postMessage 依赖 content script 在站点页注入；极端权限场景见 TC-01。
