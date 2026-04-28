# BRAINSTORM 需求池 — 阶段 A QA

> 对应实现：`fea/brainstorm-phase-a-tri`（Web 快捷键文案 + 扩展「打开笔记本」）

## 0. 本次执行记录

| 时间 | 动作 | 结果 |
|------|------|------|
| 2026-04-28 | `npm run test`（Vitest） | **PASS**（12 tests；含 `__tests__/keyboard-send-hint.test.ts`） |
| 2026-04-28 | `npm run test:e2e:full`（`npm run build` → `npm run test:e2e`） | **PASS**（Playwright：**E2E-A1-01〜04**） |
| 2026-04-28 | `npm run build`（Next）+ `chrome-extension`：`npm ci` → `npm run build` | **PASS** |
| 2026-04-28 | 手测 §0.2：**Web TC-A1**（Mac / 手机 / 补充项；Win/Linux 行以 **E2E-A1-02** 背书） | **PASS**（见 **TC-A1** 表） |
| 2026-04-28 | 手测：**TC-A2**（扩展「打开笔记本」）、**RT-A1**（划词 + 存笔记） | **PASS** |
| 2026-04-28 | **阶段 A 用户验收** | **通过** |

**手测建议环境**：桌面用 `npm run dev` → `http://localhost:3000`。**真机与同网电脑**：`npm run dev:lan`（监听 `0.0.0.0`，终端会打印 `http://<局域网IP>:3000`；扩展 Options 里 `apiBaseUrl` 填该机 IP，不要用 `localhost`）。Chrome 加载 `chrome-extension/dist/`。**Vercel Preview** 上复核时，将扩展 Options 中 API 地址改为 Preview URL 后重载扩展。

---

## 0.1 自动化测试

**命令**（仓库根目录）：

| 类型 | 命令 | 与 QA 关系 |
|------|------|------------|
| 单元/契约 | `npm run test` | 对应本节与 `__tests__`（纯函数 UA 逻辑） |
| 浏览器冒烟（A1 DOM） | `npm run test:e2e`（需先有 **`npm run build`**；也可用 **`npm run test:e2e:full`** 一步跑） | 对应 §0.2 Web（A1）中带 **E2E-A1-xx** 的步骤 |

一次跑齐单元测：

```bash
npm run test
```

A1 浏览器 E2E（首次需 `npx playwright install chromium`）。Playwright 在默认端口 **3107** 上启动 `npm run start`，与「本机 `:3000` 上的 `next dev`」可并存，但须先有生产构建（见 `playwright.config.ts` 注释）。

```bash
npm run test:e2e:full
```

或分步：`npm run build && npm run test:e2e`。若要在已有 dev（含本次代码）上验收：`PLAYWRIGHT_SKIP_WEBSERVER=1 PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npm run test:e2e`

**覆盖（阶段 A 相关）**：

- **`__tests__/keyboard-send-hint.test.ts`**：手机 / 桌面 UA → 是否跳过提示、⌘ vs Ctrl（`lib/keyboard-send-hint.ts`）。
- **`e2e/a1-home-send-shortcut-hint.spec.ts`**：首页挂载后 `data-testid="home-send-shortcut-hint"` 的文案与显隐（含 `addInitScript` 伪 Mac / Win / iPhone，与 **E2E-A1-01〜04** 对表）。
- 既有 `__tests__/cors.test.ts`、`__tests__/same-page-origin.test.ts` 应仍 **PASS**，作为邻域回归锚点。

**仍须手测（不能或不宜用本仓库 E2E 替代）**：真机手机（UA 特例、触控与视口）、**⌘+Enter / Ctrl+Enter 实际提交**（键盘行为）、首屏 **hydration 控制台**、**iOS Safari 聚焦是否缩放整页**（`text-base`）；扩展内链接与 A-2 全文。

---

## 0.2 手测步骤（最小路径 + 可选项）

以下与 **`e2e/a1-home-send-shortcut-hint.spec.ts`** 对表；合并前建议 **Vitest + Playwright** 与关键手测均绿。

### 最小路径（约 10 分钟，合并前建议必做）

**Web：快捷键提示（A-1）**

| 编号 | 步骤摘要 | Playwright |
|------|----------|-------------|
| **E2E-A1-01** | 默认桌面宿主：首页 `/` 有合法快捷键文案（⌘ 或 Ctrl 其一） | 断言 `/` 角标正则 `^(⌘↵ 发送|Ctrl\+Enter 发送)$` |
| **E2E-A1-02** | 「桌面 Win/Linux」类环境 → `Ctrl+Enter 发送` | 伪 UA **Windows** → 断言 `Ctrl+Enter 发送` |
| **E2E-A1-03** | 「桌面 Mac」类环境 → `⌘↵ 发送` | 伪 UA **Mac** → 断言 `⌘↵ 发送` |
| **E2E-A1-04** | 「手机」类 UA → **无** `home-send-shortcut-hint` 节点 | 伪 UA **iPhone** → `getByTestId` **count 0** |

以下内容 **仅手测**，原因：**物理键盘提交** / **控制台** / **真机** / **iOS 缩放** E2E 未覆盖或未替代真机：

1. **桌面 — Mac**：在输入框内 `⌘ + Enter`（非空）应能提交。
2. **桌面 — Windows 或 Linux**：`Ctrl + Enter` 应能提交。
3. **手机（必选）**：用 iPhone / Android 自带浏览器或扫码打开同一站点首页，输入区右下角**不出现** ⌘/Ctrl 类快捷键提示。
4. **仅用 Chrome DevTools（可选补充）**：覆盖 UA 不能完全代替真机触控；以第 3 步真机为准。
5. 打开浏览器控制台：首屏 **无** 与文案相关的 hydration 报错。
6. **iOS Safari**：在首页焦点进入输入框时，页面**不按 iOS 习惯自动缩放**（依赖输入框移动端 `font-size ≥ 16px` / `text-base`）。

**扩展：打开笔记本（A-2）**

（仅手测：未打包扩展不进 Playwright smoke，见 `qa-e2e-smoke`）

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
| Web 首页输入区 | `app/page.tsx` | 挂载后依 UA 显示 ⌘↵ / Ctrl+Enter；**手机不显示** |
| 快捷键决策 | `lib/keyboard-send-hint.ts` | 纯函数 UA 判别 + 文案；Vitest |
| 扩展划词卡片 | `chrome-extension/src/content/ExplainCard.tsx` | Footer 增加「打开笔记本」外链 |

### 不受影响（可跳过深度回归）

- `/api/explain`、`/api/notes` 路由实现
- CORS、连接插件桥接逻辑（无文件改动）

---

## 2. 功能测试（TC）

### TC-A1 Web：桌面提示一致；手机不展示

| 步骤 | 预期 | 手测 |
|------|------|------|
| **桌面 Mac**：查看提示 | 展示 `⌘↵ 发送` | **PASS** |
| **桌面 Mac**：`⌘+Enter` | 提交当前输入（非空） | **PASS** |
| **桌面 Win/Linux**：查看提示 | 展示 `Ctrl+Enter 发送` | **未测**（**E2E-A1-02** + Vitest 已覆盖） |
| **桌面 Win/Linux**：`Ctrl+Enter` | 提交当前输入（非空） | **未测** |
| **手机浏览器**（iPhone / Android 手机 UA） | 输入区右下角**无**快捷键提示文案 | **PASS** |

**合计**：验收通过。**Win/Linux** 快捷键两行未做实机点击，已由 **E2E-A1-02** 与 Vitest 覆盖；若日后需工单级留痕可在实机补齐并更新上表两行。

### TC-A2 扩展：打开笔记本

| 步骤 | 预期 | 手测 |
|------|------|------|
| 解释完成后点「打开笔记本」 | 新开标签，`…/notebook` 与配置的 `apiBaseUrl` 同源 | **PASS** |
| 链接 `rel` | `noreferrer`，`target="_blank"` | **PASS** |

**结果**：［✓］ PASS ［　］ FAIL — 备注：**阶段 A 手测已通过**

---

## 3. 回归测试（RT）

### RT-A1 划词解释与存笔记

| 步骤 | 预期 | 手测 |
|------|------|------|
| 划词 → 流式解释 | 与改前一致，无报错 | **PASS** |
| 点「存入笔记本」（已登录） | 仍可成功或显示既有错误态 | **PASS** |

**结果**：［✓］ PASS ［　］ FAIL — 备注：**阶段 A 手测已通过**

---

## 4. 测试结论

- **结论**：**PASS**（**阶段 A 用户验收通过**：**TC-A1**（含 Mac/手机与 E2E 背书的 Win/Linux）、**TC-A2**、**RT-A1**）
- **遗留问题**：无（**可选**：后续在 Windows / Linux **实机**再点按 **TC-A1** 表中两行，仅作增强留痕，非阻塞）
- **签认**：（可选）Tester：________　日期：**2026-04-28**

---

## 5. 与任务清单对表

结项目录：`dev/done/BRAINSTORM阶段A/`；提要见 `dev/logs/BRAINSTORM阶段A-log.md`。需求池（含 B/C/D）：[`dev/active/BRAINSTORM需求池/README.md`](../../active/BRAINSTORM需求池/README.md)。
