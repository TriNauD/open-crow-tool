# BRAINSTORM — 阶段 A 详案（已结项）

> **版本**：v1.1 | 2026-04-27（文档整理 2026-04-28）  
> **状态**：阶段 A **已交付并结项**。  
> **全局需求矩阵与 B/C/D**：[`dev/active/BRAINSTORM需求池/roadmap.md`](../../active/BRAINSTORM需求池/roadmap.md)  
> **QA**：[`阶段A-qa.md`](./阶段A-qa.md)

---

## A-1 Web：按客户端显示「发送」快捷键提示（手机不显示）

**问题**：首页输入框右下角固定为 `⌘↵ 发送`，与 Windows/Linux 实际可用的 `Ctrl+Enter` 不一致（逻辑上已支持 `e.ctrlKey`，仅文案错误）。**补充（A-1 迭代）**：在手机浏览器上 ⌘/Ctrl+Enter 不适用作普适提示，**不展示该行提示文案**。

**方案**：

- **手机浏览器**（iPhone/iPod、`Android … Mobile …`、常见移动浏览器 UA）：**不显示**快捷键提示文案；仍保留「这是啥？」按钮发送。
- **非手机的桌面/平板**：按平台展示文案：
  - Apple 系（桌面 Mac / iPad 等）：`⌘↵ 发送`。
  - Windows / Linux：**`Ctrl+Enter 发送`**。
- 实现要点：`lib/keyboard-send-hint.ts` 封装 UA/`platform` 判断；在 `app/page.tsx` 用 `useEffect` 设文案（或空串），避免 SSR 与 hydration 不一致。**移动端**：输入类控件使用 **`text-base md:text-sm`（≥16px）**，避免 **iOS Safari 聚焦表单时强制缩放整页**；登录 / 订阅等页同理。

**主要改动文件**：

- `lib/keyboard-send-hint.ts`（UA 判别与文案；可供 Vitest）
- `app/page.tsx`（挂载后写入提示；手机端不写提示）

**验收**：

- macOS + Windows：**提示**与物理键盘可发送组合键一致。
- **手机**：输入区右下角**无** ⌘/Ctrl 提示文案，仅按钮；控制台无 hydration 报错。
- 桌面：`Enter` + `Ctrl` / `⌘` 行为与改前一致（仅提示展示策略变）。

**风险**：极低。注意 hydration：hint 区域若初渲染与客户端不一致，用 `mounted` 门闩或仅在 `useEffect` 后显示平台文案。

---

## A-2 Extension：划词卡片「打开笔记本」

**问题**：用户存笔记或想浏览历史时，希望在扩展划词 UI 内一键回到 Web 笔记本，而不是手动找网站。

**方案（MVP）**：

1. 在 `ExplainCard` 底部操作区增加次要按钮或链接：**打开笔记本**。
2. 目标 URL：`${config.apiBaseUrl}/notebook`（与插件配置的站点同源，避免硬编码生产域名）。
3. 使用 `target="_blank"` + `rel="noreferrer"`，与现有「回网站」链接一致。
4. **与「存入笔记本」的关系**：并存；不替代保存流程。可选增强（本期不强制）：保存成功且 `savedId` 为真实 id 时，同一链接可带 query（仅当 `app/notebook` 已支持按 id 定位/展开时再实现；当前笔记本页无 `?id=` 时，MVP 只做 `/notebook`）。

**主要改动文件**：

- `chrome-extension/src/content/ExplainCard.tsx`（footer 区域布局与样式，复用现有 `crow-card-footer` 类）
- 若需样式：`chrome-extension` 内对应 CSS（若有独立样式表则同步）

**验收**：

- 已登录配置下，点击「打开笔记本」在新标签打开正确环境的笔记本页。
- 未登录：仍可打开站点笔记本页（行为与直接访问站点一致；若需登录由站点处理）。
- 划词、流式解释、保存、Esc 关闭等现有流程无回归。

**风险**：低。注意 URL 拼接（`apiBaseUrl` 无尾部斜杠时 `/notebook` 路径正确）。

---

## 测试与发布（本阶段归档）

- **QA 主文档**：[`阶段A-qa.md`](./阶段A-qa.md)。
- **自动化**：`npm run test`（含 `__tests__/keyboard-send-hint.test.ts`）；E2E 见 QA §0.1。
- 低风险发布：`qa-process.mdc` 对核心链路 smoke 的豁免说明可写入 PR。
