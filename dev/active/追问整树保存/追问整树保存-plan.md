# 追问整树保存 — Plan

> **前置**：四项决策用户已拍板（2026-09-08），见 [context](./追问整树保存-context.md)；编码下一轮。
> **分支建议**：`fea/ext-card-tree-save`（从最新 `dev` 切出，基于已有 `fea/ext-card-tree-index-tri`）。

## 端到端 UX 流程（用户视角）

1. 划词 → 出现主卡 → 追问 3 轮（流式 + 列表展开）→ 树索引把手自动出现（`maxDepth≥2 || N≥3`，沿用既有阈值）
2. 点根卡 footer「存入笔记本（连同 3 条追问）」→ 拍快照 → 循环 POST 4 条（N+1=根+3 子）→ footer 变「✓ 已存 1+3 条 [更新到笔记本]」
3. 关卡片继续刷网页。再划词第二次，触发独立主卡——**两条树互不干扰**。
4. 想在笔记本看：点 footer「打开笔记本」→ 列表里看到一行「📒 这是啥？追问对话 · 4 条」→ 点开看 4 条时间线 + 每条带"追问时的上下文"灰框
5. 改父卡分类 RAG → 子卡的分类标签同步变 RAG（行内串行 PATCH）
6. 删父卡 → 弹「将同时删除 3 条追问」确认 → 一键删除整组
7. 回扩展侧，已存的根卡继续追问 1 条新子 → footer 仍是「✓ 已存 1+3 条」——新追问不自动入库；点「更新到笔记本」→ 整树覆盖为 1+4 条
8. 中途网断 → 部分成功 → footer 变「⚠️ 已存 2/4 条，重试失败项」→ 一键重试

## 实施顺序（沿依赖：扩展 → API → Web）

| 阶段 | 范围 | 关键产物 |
|---|---|---|
| **Step 1. 扩展侧整树保存** | `ExplainCard.tsx` 拍快照 + 循环 POST + footer 三态；`card-tree.tsx` 加 `flattenTree()` 纯函数 | 单卡可整树入库；失败降级+标红；测试 snapshot 拍下后 children 变化不影响入库 |
| **Step 2. 扩展侧「更新到笔记本」** | 已存态多一按钮：按根 `clientNoteId` 反查 → 删旧 → 重存 | 和 Step 1 同一文件；不动 API（前端循环 DELETE + POST） |
| **Step 3. 子卡 footer 「只存本条」** | 子卡 footer 加次级按钮，沿用现有 `handleSave`（不传 parentId）；clientNoteId 独立 UUID | 复用现有逻辑，几乎零改动 |
| **Step 4. Web 笔记本聚合** | `app/notebook/page.tsx` 按 `parentId` 分桶 + 父徽章 + 折叠 + 分类整组 + 整组级联删除 | 整组可见性一致；删除确认二次；tags 整组 PATCH |
| **Step 5. 代码地图同步** | `docs/map/ext-content.md`、`docs/map/web-ui.md` 同步本批变更 | `scripts/check-map.mjs` 通过；CI 绿 |

> API/DB **全程不动**——`POST /api/notes` 的 `parentId`/`parentText`/`clientNoteId` 入参已支持。仅 `lib/api/notes-client.ts` 的 `createNote` 入参加 `parentId?: string`（仅签名扩展，老调用不破）。

## 非目标

- 笔记本端树形渲染（决策 3 显式不做）
- 已存笔记的反向同步（决策 2：不自动同步）
- 差量更新（context 待明确 #1 已选整树覆盖）
- Web 侧 `components/ExplanationCard.tsx` 无追问树，本需求**不**触达

## [PM] 验收要点

### 手动（产品视角）

- 主卡 0 追问：footer 行为与旧版完全一致（向后兼容）
- 主卡 N≥1 追问：根 footer 显示「整树」主按钮 + 「只存本条」次级 + 错误态标红重试
- 已存后再追问 N+1：footer 不变，新追问不入库，需点「更新到笔记本」才生效
- 子卡 footer：始终只有「只存本条」入口（不出现整树按钮）
- 更新整树：旧整树消失，新整树替代（server 时间刷新）
- 部分失败：UI 明确「已存 k/N」+ 可重试
- 笔记本列表：父卡「追问对话 · N 条」徽章；展开时间线；改 tags 整组同步；删父弹确认框
- guest 整树保存：localStorage 内正确写入父子关联（clientNoteId 共用）

### 自动（CI + 单测）

- `__tests__/card-tree.test.ts` 新增：`flattenTree` 空树/单层/多层，节点深度、parentId 正确
- E2E（视能力）：扩展内保存 N≥1 → 关卡 → 重开新 session → 笔记本拉列表 → 父徽章正确 + 子卡 `parentText` 等于根 `inputText`
- `scripts/check-map.mjs` 通过
- `npm run verify` 全绿

## 风险与回滚

- **整树保存并发**：用户在保存发起后继续追问 → snapshot 在点击瞬间锁定，循环 POST 只用快照源（见 context #4）——失败模式：state 取了 ref 之后再被 set 改写，导致子卡 POST 用了旧 explanation。规避：snapshot 用 `useRef` 持锁 + useState 初始化时建表。
- **更新整树与已存后追问竞态**：用户点「更新」同时还在打字追问。给当前按钮加 `disabled={isSaving}`（沿用现有），且「更新」行为本身是覆盖式，用户预期就是覆盖。
- **级联删除误删**：删父时确认框明确「N 条追问」，且 N=0 时不弹（单条不需要二次确认）。
- **Web 侧整组 PATCH tags 失败**：单条失败 → 已成功的留住，失败那条在 UI 闪红 + 重试按钮。
- **回滚**：footer 「整树」按钮可被一行 if 条件禁用，回到 `handleSave` 老逻辑；DB schema 0 改动，回滚无副作用。

## [Decision]

四项用户决策（2026-09-08）+ 8 项 PM 内部决策详见 [context 待明确事项](./追问整树保存-context.md#待明确事项我作为-pm-的推荐已附不要全部抛给三角)；其中 #5 footer 文案、#7 分类整组语义需要主理人 sign-off。
