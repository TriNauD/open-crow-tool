# BRAINSTORM 需求池 — 阶段 A QA

> 对应实现：`fea/brainstorm-phase-a-tri`（Web 快捷键文案 + 扩展「打开笔记本」）

## 0. 本次执行记录

| 时间 | 动作 | 结果 |
|------|------|------|
| （待填） | `npm run test`（Vitest） | （待填：PASS / FAIL） |
| （待填） | `npm run build` + `cd chrome-extension && npm run build` | （待填） |
| （待填） | 手测 §0.2 最小路径（Web + 扩展） | （待填） |
| （待填） | 测试结论 | **PENDING**（PASS / FAIL + 遗留） |

**手测建议环境**：`npm run dev` → `http://localhost:3000`；Chrome 加载 `chrome-extension/dist/`；扩展 `apiBaseUrl` 与本机 Web 一致。**Vercel Preview** 上复核时，将扩展 Options 中 API 地址改为 Preview URL 后重载扩展。

---

## 0.1 自动化测试

**命令**（仓库根目录）：

```bash
npm run test
```

**覆盖（阶段 A 相关）**：

- 本需求**未**新增 Vitest 用例（平台检测在 `useEffect` 内，依赖 `navigator`）。
- 既有 `__tests__/cors.test.ts`、`__tests__/same-page-origin.test.ts` 应仍 **PASS**，作为邻域回归锚点。

**不能自动化、须手测**：真实 OS 上快捷键提示文案、扩展内链接打开正确 origin 的 `/notebook`、浏览器新标签行为。

---

## 0.2 手测步骤（最小路径 + 可选项）

当前仓库**未**接入 Playwright/E2E；无 `E2E-xx` 对表。以下内容作为**阶段 A 手动验收**；若后续补齐 E2E，可将关键步映射为 `E2E-01` 等写入本文件并改 `qa-e2e-smoke` 技能。

### 最小路径（约 10 分钟，合并前建议必做）

**Web：快捷键提示（A-1）**

1. 打开首页 `/`，找到输入框右下角灰色提示。
2. **在 Mac（或 iPad 上桌面 Safari）**：应为 `⌘↵ 发送`；在输入框内按 `⌘ + Enter` 应能提交非空问题（与改前一致）。
3. **在 Windows 或 Linux**：应为 `Ctrl+Enter 发送`；按 `Ctrl + Enter` 应能提交。
4. **仅用 Chrome DevTools（可选）**：暂无实机时，`More tools → Sensors` 或覆盖 User-Agent 不能完全模拟 `navigator.platform`，仍以**实机或通过远程浏览器**核验为准。
5. 打开浏览器控制台：首屏hydration **无** React #418 / 「Text content does not match」类报错（与本页提示文案相关）。

**扩展：打开笔记本（A-2）**

1. `cd chrome-extension && npm run build`，在 `chrome://extensions` **重新加载**扩展。
2. 与扩展使用**同一站点**登录，并完成「连接插件」（与既有扩展 QA 一致）。
3. 在**任意网页**划词 → 等到解释流式输出结束，底部出现「存入笔记本」区域（或错误态）。
4. 点击 **「打开笔记本」**：应在**新标签**打开 `{apiBaseUrl}/notebook`，地址栏 host 与 Options 里 API 域名一致。
5. 再测一次：**先点「存入笔记本」成功**（或失败后）再点「打开笔记本」；确认 **Esc 关闭卡片**、**点击外部关闭**仍为预期。
6. 未登录或过期的场景：若能复现过期提示，仍可点击「打开笔记本」，站点应能对未登录展示登录流或可读笔记本（按现有站点行为，本条不新增契约）。

### 全量可选（有重大改动时再跑）

- 扩展：**连接插件**整条路径（可参考 `dev/done/Chrome扩展多用户鉴权/Chrome扩展多用户鉴权-qa.md` 最小路径）。
- **核心链路**（订阅/退订/邮件）：本 PR **未改**相关 API；按 `qa-process.mdc` 属 **low-risk**，可 **不跑**；若团队当次发布要求全量，再补跑 `dev/regression.md`（若存在）。

---

## 1. 影响域标注

| 项 | 内容 |
|----|------|
| **需求名称** | BRAINSTORM 需求池 — 阶段 A |
| **风险等级** | **Low**（文案 + 扩展 footer 链接；不改 API、不改鉴权契约） |

### 涉及模块

| 模块 | 文件 | 改动性质 |
|------|------|----------|
| Web 首页输入区 | `app/page.tsx` | 按平台显示发送快捷键提示；`useEffect` 设文案 |
| 扩展划词卡片 | `chrome-extension/src/content/ExplainCard.tsx` | Footer 增加「打开笔记本」外链 |

### 不受影响（可跳过深度回归）

- `/api/explain`、`/api/notes` 路由实现
- CORS、连接插件桥接逻辑（无文件改动）

---

## 2. 功能测试（TC）

### TC-A1 Web：提示与真实快捷键一致

| 步骤 | 预期 |
|------|------|
| Mac：查看提示 | 展示 `⌘↵ 发送` |
| Mac：`⌘+Enter` | 提交当前输入（非空） |
| Win/Linux：查看提示 | 展示 `Ctrl+Enter 发送` |
| Win/Linux：`Ctrl+Enter` | 提交当前输入（非空） |

**结果**：［　］ PASS ［　］ FAIL — 备注：___________

### TC-A2 扩展：打开笔记本

| 步骤 | 预期 |
|------|------|
| 解释完成后点「打开笔记本」 | 新开标签，`…/notebook` 与配置的 `apiBaseUrl` 同源 |
| 链接 `rel` | `noreferrer`，`target="_blank"` |

**结果**：［　］ PASS ［　］ FAIL — 备注：___________

---

## 3. 回归测试（RT）

### RT-A1 划词解释与存笔记

| 步骤 | 预期 |
|------|------|
| 划词 → 流式解释 | 与改前一致，无报错 |
| 点「存入笔记本」（已登录） | 仍可成功或显示既有错误态 |

**结果**：［　］ PASS ［　］ FAIL — 备注：___________

---

## 4. 测试结论

- **结论**：**PENDING**（合并前改为 **PASS** 或 **FAIL**）
- **遗留问题**：（无则写「无」）
- **签认**：（可选）Tester：________　日期：________

---

## 5. 与任务清单对表

手测勾选以 `BRAINSTORM迭代计划-tasks.md` 为准；PASS 后将任务文件中「手测」项勾为 `[x]`，并将本文件 §0 「本次执行记录」表填完整。
