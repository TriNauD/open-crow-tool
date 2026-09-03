# 追问树形索引 — Context

> **来源**：用户 2026-09-03 对话（子卡片 UX 迭代时提出，用户点名「做一个新的需求」）
> **立项性质**：**前瞻立项文档**（文档先行）。阶段 2 方案已确认（见下表），**编码排在下一轮**。

## 背景 / 痛点

- 解释卡的追问是**递归子卡片**（`ExplainCard` 自渲染 `depth+1`），嵌套多轮后：早先的提问与回答被顶出视野，只能靠上下滚动翻找某轮问答在哪里。
- 用户提议：主卡片左侧放一个**可收起的树形索引**，节点标题 = 每张卡片的问题文本，点击快速跳转。

## 现状（调研）

| 项 | 结论 |
|----|------|
| 卡片树结构 | 每张 `ExplainCard` 只持有自己的 `children`（局部 state），**父卡不知道孙子卡的问题文本** → 需要树注册表（Context） |
| DOM 关系 | 所有子卡内嵌在根卡 `bodyRef` 滚动区内（`.crow-child-card` 包裹层）；子卡 `position: static`（`.crow-child-card .crow-card`） |
| 折叠机制 | `.crow-card-body.collapsed { display: none }`——**隐藏但未卸载**，注册表节点与 DOM 均仍在 |
| 滚动跟随 | 出子卡后父卡 body 自动跟随滚到底（`followBottomRef`），向上滚即停（详见 `docs/map/ext-content.md` 坑位） |
| 样式隔离 | Shadow DOM，样式只能动 `chrome-extension/src/content/styles.ts` |
| 平行实现 | Web 版 `components/ExplanationCard.tsx` 无折叠/跟随逻辑（页面自然流），本需求**仅扩展侧** |

## 用户已确认的关键决策（2026-09-03 问答）

| 决策点 | 结论 |
|--------|------|
| 出现时机 | **达到阈值才出现**：嵌套 ≥2 层（出现孙卡）或子卡 ≥3 张时自动出现；出现后可手动收起（收起后留把手） |
| 形态 | **左缘浮层**：默认收成贴主卡左缘的小把手，点开浮层盖在页面内容上，**不挤压** 360px 卡片布局 |
| 跳转行为 | **定位 + 高亮**：平滑滚动到目标卡片并橙色高亮一瞬；目标或其祖先被折叠时**自动展开**后再定位 |
| 推进方式 | 立项先行，**编码下一轮** |

## 约束

- **浮层裁剪**：`.crow-card` 有 `overflow: hidden`，负偏移的左缘浮层会被裁剪 → 浮层必须渲染在卡片根元素**之外**（Shadow DOM 根直挂 / portal 到卡片同级），定位用卡片 `pos` state 同步（卡片可拖拽时两者一起动）。
- **折叠与跳转**：`display: none` 元素 `scrollIntoView` 无效 → 跳转前须沿祖先链调用各卡的展开（需注册表登记每张卡的展开回调）。
- **与「跟随滚到底」的交互**：树跳转定位后必须关掉 `followBottomRef`（等价一次用户向上滚），否则 ResizeObserver 会把视图拉回底部。
- **视口越界**：卡片贴屏幕左缘时浮层会出界 → MVP 先 clamp 到视口内（后续可做右侧翻转）。
- 文本截断：树节点标题取各卡 `text`（问题），CSS 两行截断。
- 新增源码文件必须收录 `docs/map/ext-content.md`（`scripts/check-map.mjs` 强校验）。

## 依赖与风险

- **依赖**：`chrome-extension/src/content/ExplainCard.tsx`、`styles.ts`；建议新增纯逻辑模块（注册表 / 阈值 / 树构建）供根目录 Vitest 直测。
- **风险**：注册表 Context 放在根卡，卡片数小（会话内追问数），重渲染影响可控；浮层遮页面内容属预期行为，需 Esc / 点外部可收。
- **回滚**：去掉把手渲染分支即恢复旧行为，注册表无副作用。

## 文档索引

- [`追问树形索引-plan.md`](./追问树形索引-plan.md)
- [`追问树形索引-tasks.md`](./追问树形索引-tasks.md)
- [`追问树形索引-qa.md`](./追问树形索引-qa.md)
- [`追问树形索引-dev-preview-acceptance.md`](./追问树形索引-dev-preview-acceptance.md)
