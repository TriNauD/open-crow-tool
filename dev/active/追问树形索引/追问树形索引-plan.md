# 追问树形索引 — Plan

> **分支建议**：`fea/ext-card-tree-index-tri`（从最新 `dev` 切出）
> **前置**：方案四项决策已经用户确认（2026-09-03，见 [context](./追问树形索引-context.md)），编码排下一轮。

## 目标

1. 主卡片左侧**树形索引**：展示整棵追问树（节点 = 问题文本，缩进 = 层级），阈值（嵌套 ≥2 层或子卡 ≥3 张）自动出现，可手动收成左缘把手。
2. 点击节点：平滑滚动定位对应卡片 + 橙色高亮一瞬；目标或祖先被折叠时**自动展开**后再定位。
3. 跳转后停止父卡「跟随滚到底」的自动跟随，把滚动控制权交还用户。

## 非目标

- 不做节点拖拽排序 / 编辑问题 / 删除分支（后续可议）。
- 不做持久化（索引仅卡片生命周期内，关卡即销毁）。
- Web 端 `components/ExplanationCard.tsx` **不做**（页面自然流、无滚动容器，无此需求；平行实现不同步）。

---

## [PM] 验收要点（草案）

- 子卡 1~2 张且单层时：**无**把手、无任何干扰。
- 追问 ≥3 张，或出现孙卡（嵌套 2 层）：主卡左缘自动出现索引把手。
- 点把手展开浮层树，层级缩进清晰、长问题两行截断；再点收成把手。
- 点击节点：平滑滚到对应卡片并橙色高亮一瞬；目标被折叠（自身或祖先）时先自动展开再定位。
- 跳转后视图**停留**在目标处，不被「跟随滚到底」拉走；用户仍可正常滚动。
- 关闭主卡后索引随之销毁，无残留 DOM。

---

## [TL] 技术方案

### 1. 树注册表（新增纯逻辑 + Context）

- 新增 `chrome-extension/src/content/card-tree.tsx`：
  - `CardTreeProvider`：挂在**根卡**（depth 0）上，持有注册表 `Map<id, CardNode>`；
  - `CardNode = { id, question, parentId, depth, el, expand() }`——`el` 为卡片根 DOM 节点，`expand()` 为该卡「解除折叠」的回调；
  - 每张 `ExplainCard` 挂载时 `register(...)`、卸载时 `unregister(id)`（折叠只是 `display:none`，**不**触发注销）；
  - 暴露派生只读结构：`tree`（按注册顺序构建父子树，与渲染顺序一致）、`stats`（总卡数、最大深度）、`jumpTo(id)`。
- 阈值判断做成**纯函数**（`shouldShowIndex(stats)`：`maxDepth >= 2 || totalCards >= 3`），单测直测。

### 2. 浮层渲染与样式

- 浮层**不渲染在 `.crow-card` 内部**（会被 `overflow: hidden` 裁剪），而是 Shadow DOM 根下与根卡并列（`createPortal` 到 shadow root 容器）。
- 定位：`position: fixed`，与根卡共用 `pos` state——`left = pos.x - PANEL_W - 8`，`top = pos.y`；拖拽/落位变化天然同步；越界时 clamp 到视口内。
- 两种状态（根卡局部 state）：
  - **把手**（默认）：贴卡片左缘的小竖条按钮（`◀ 目录`），仅在阈值满足时出现；
  - **展开**：约 200~240px 宽浮层，树形列表（`padding-left` 缩进表层级），节点 = 两行截断的问题文本；点把手或浮层外收起；Esc 收起。
- `styles.ts` 新增：`.crow-tree-handle` / `.crow-tree-panel` / `.crow-tree-node`（含 hover、当前分支态）/ `.crow-index-flash` 高亮动画（橙色边框+背景脉冲 ~1.2s，`animationend` 后移除 class）。

### 3. 跳转链路

- `jumpTo(id)`：
  1. 从注册表沿 `parentId` 找祖先链，逐个调 `expand()`（root 卡 body 折叠时也展开）；
  2. `requestAnimationFrame` 等一帧布局后，对目标 `el.scrollIntoView({ behavior: 'smooth', block: 'center' })`（滚动容器为根卡 body；子卡自身不滚）；
  3. 目标卡容器（`.crow-child-card`，根卡则 body 顶部）加 `.crow-index-flash`，动画结束移除；
  4. **置 `followBottomRef.current = false`**（根卡经 Context 暴露 `stopFollow()`）。
- 当前可视节点高亮（可选项，MVP 可后置）：IntersectionObserver 或滚动位置比对，标记「当前分支」节点。

### 涉及文件（预估）

- `chrome-extension/src/content/ExplainCard.tsx`（注册/注销、阈值、把手+浮层渲染、stopFollow）
- **新增** `chrome-extension/src/content/card-tree.tsx`（Context + 注册表 + 阈值/树构建纯逻辑）
- `chrome-extension/src/content/styles.ts`（把手/浮层/节点/高亮样式）
- `docs/map/ext-content.md`（收录新文件 + 职责更新）
- `docs/product/chrome-extension.md`、`docs/tech/phase-2-chrome-extension.md`（定稿时一句）
- 测试：`__tests__/card-tree.test.ts`（树构建/阈值/祖先链）；E2E 视 `e2e/extension-fixtures.ts` 能力加一条跳转用例（可选）

### 风险与回滚

- **浮层裁剪**：必须挂在卡片元素外，方案已定（见 context 约束）。
- **流式渲染期跳转**：目标回答仍在流式输出时定位会随内容增高漂移——MVP 接受（`followBottom` 已关，用户可再点一次节点重定位）。
- **回滚**：移除把手渲染分支即恢复旧行为；注册表随卡卸载清理，无持久副作用。

---

## [QA] 影响域

- 扩展解释卡全链路回归：划词 → 解释 → 追问 → 折叠 → 保存（注册表不应影响保存/查重）。
- 折叠徽章（含本轮新加的子卡折叠）与树跳转的联动。

## [Decision]

- 阈值 `maxDepth >= 2 || totalCards >= 3`；浮层形态；定位+高亮+自动展开；仅扩展侧。均已与用户确认（2026-09-03）。
