# 笔记重复检测 QA

## 0. 本次执行记录

| 时间 | 动作 | 结果 |
|------|------|------|
| 2026-04-27 | `npm run lint` | PASS（0 errors，extension 1 条既有 warning） |
| 2026-04-27 | `npm run build` | PASS |
| 2026-04-27 | 浏览器手测 TC-01～02、04～06 | **PASS（用户验收）** |

**手测环境**：`npm run dev`，`http://localhost:3000` / Preview。

## 1. 影响域标注

- 需求名称：笔记重复检测（Phase 5.1）
- 测试阶段：QA 验收
- 风险等级：**Medium**（仅影响「存到笔记本」路径；不改动笔记 API 契约）

### 涉及模块

- UI：`components/ExplanationCard.tsx`、`components/DuplicateNoteModal.tsx`
- 客户端 API：`lib/api/notes-client.ts`（`replaceNote` = DELETE + POST）
- 游客存储：`lib/guest-notes.ts`（读列表 / 删除单条 / 写入）
- 后端：**无变更**（重复判断在前端 + `GET /api/notes?q=` 搜索结果上精确过滤）

## 2. 测试前置条件

- [x] `npm run dev` 或 Vercel Preview 可访问
- [x] 已登录场景：测试账号可写笔记本，`GET /api/notes` 正常
- [x] 游客场景：可使用无痕窗口或清空 `localStorage` 中 `crow_guest_notes_v1` 后测试
- [x] 静态验收：`npm run lint`（0 error）、`npm run build` 通过

## 3. 功能测试（新功能）

**手测快查**（与 TC-01～06 一一对应，建议按序做）  

1. **已登录 + 弹窗 + 都保留**（TC-01 + TC-04）：登录 → 首页输入唯一词 A → 等结束 → 存笔记本 → 回首页再输入**标准化等价**的 A（如改大小写/空格）→ 再存 → 应弹窗 → 点「都保留」→ `/notebook` 应可见 **2 条** 同题。  
2. **覆盖旧的**（TC-05）：再重复「同词存一次」至弹窗 →「覆盖旧的」→ `/notebook` 该题仅 **1 条** 且为新解释。  
3. **游客**（TC-02）：无痕或未登录，清空 `localStorage` 键 `crow_guest_notes_v1` 后重复步骤 1 逻辑 → 第二次应弹窗。  
4. **追问不弹**（TC-03）：在解释中划词点「这又是啥？」→ 在**子卡片**上点存笔记本 → 不应出现「已有同名笔记」。  
5. **布局**（TC-06）：弹窗时缩窄/拉宽视窗，移动纵向、桌面两列。  

---


### TC-01 已登录：同词第二次保存弹出对比

- [x] **步骤**：登录 → 首页输入词 A，等解释完成 → 点「存到笔记本」→ 再次首页输入同一词 A（允许大小写/多空格差异，如 `RAG 是啥` 与 `rag是啥`），等新解释完成 → 再点「存到笔记本」
- [x] **预期**：出现「已有同名笔记」弹窗；旧/新答案分区可读；可先看到「检查中...」再弹窗
- [x] **结果**：**PASS（用户验收）**

### TC-02 游客：同词第二次保存对比 localStorage

- [x] **步骤**：未登录 → 同上保存两次同标准化等价的词 A
- [x] **预期**：第二次点「存到笔记本」时弹窗；旧内容来自此前写入的游客笔记
- [x] **结果**：**PASS（用户验收）**

### TC-03 追问（划词继续问）不触发重复检测

- [x] **步骤**：（代码审查）嵌套 `ExplanationCard` 使用 `depth > 0` 且传入 `context={text}`
- [x] **预期**：`shouldCheckDuplicate = depth === 0 && !context` 为 false 时不调用 `findCloudDuplicate` / `findGuestDuplicate`
- [x] **结果**：**PASS（代码审查）**

### TC-04「都保留」：笔记本两条

- [x] **步骤**：在 TC-01 或 TC-02 弹窗中点击「都保留」→ 打开 `/notebook` 或刷新列表
- [x] **预期**：同一 `inputText`（展示上可能空格不同）对应两条记录，两条解释分别为旧流式结果与新流式结果
- [x] **结果**：**PASS（用户验收）**

### TC-05「覆盖旧的」：仅保留新的一条

- [x] **步骤**：再次制造重复弹窗 → 点「覆盖旧的」→ 查看笔记本
- [x] **预期**：该问题仅一条笔记，解释为新答案；登录态旧 id 被删后新 post（`replaceNote`）
- [x] **结果**：**PASS（用户验收）**

### TC-06 布局：移动端上下 / 桌面左右

- [x] **步骤**：弹窗打开时，窄视窗（&lt; md）与宽视窗（≥ md）各看一次
- [x] **预期**：`grid-cols-1 md:grid-cols-2`，移动端纵向分割线、桌面横向并排
- [x] **结果**：**PASS（用户验收）**

### TC-07 云端匹配仅顶层（`parentText` 过滤）

- [x] **步骤**：（代码审查）`findCloudDuplicate` 对 `fetchNotes` 结果要求 `!n.parentText`
- [x] **预期**：带子问题的历史行不作为「顶层同名」冲突条（与 PRD 一致）
- [x] **结果**：**PASS（代码审查）**

## 4. 回归测试（受影响模块）

### RT-01 解释主链路

- [x] **说明**：`ExplanationCard` 仍挂载流式解释与选区追问；未改 `/api/explain`
- [x] **结果**：**PASS（代码审查 + build）**

### RT-02 首次保存无重复时不弹窗

- [x] **说明**：`handleSave` 仅在 `existing` 命中时 `setDuplicateNote`，否则直接 `createNote` / `saveGuestNote`
- [x] **结果**：**PASS（代码审查）**

### RT-03 订阅 / 退订核心链路

- [x] **说明**：本次未改 `subscribe` / `unsubscribe`；按 `qa-process.mdc` 发布前仍建议在回归清单执行核心链路
- [x] **结果**：**SKIP（本次改动未触及）**

## 5. 测试结论

| 类型 | 结论 |
|------|------|
| 构建与类型检查 | **PASS**（`npm run build`） |
| ESLint | **PASS**（0 errors；`chrome-extension` 另有 1 条既有 hooks warning，非本需求引入） |
| 代码审查（TC-03、TC-07、RT-01、RT-02） | **PASS** |
| 浏览器手测（TC-01、02、04、05、06） | **PASS（用户验收）** |

**总结论：PASS**（2026-04-27 用户确认其余验收项通过；结项 2026-04-27）

## 6. 遗留 / 观察（非阻塞）

- `replaceNote` 为非原子 DELETE + POST，网络异常边界见 `笔记重复检测-context.md`；当前阶段可接受。
- 游客侧 `findGuestDuplicate` 未按 `parentText` 过滤；与「追问不触发」一致依赖 `depth/context`，一般数据下与 PRD 等价。
- 登录态重复检测**不拉全量笔记**；`findCloudDuplicate` 依赖 `GET /api/notes?q=`（`ilike`）+ 客户端标准化后精确匹配。同题在极端输入变体下若与搜索错位可能漏检，**后续**再改为专用查询/规范化字段等，见 `findCloudDuplicate` 注释与 `context.md`。
