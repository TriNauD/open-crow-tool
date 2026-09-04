# 追问树形索引 — Tasks

> 分支：`fea/ext-card-tree-index-tri` → PR → `dev`
> 手测：[`追问树形索引-qa.md`](./追问树形索引-qa.md)；Preview 最小路径：[`追问树形索引-dev-preview-acceptance.md`](./追问树形索引-dev-preview-acceptance.md)

## 阶段 0：定稿

- [x] 四项决策经用户确认（2026-09-03）：阈值出现 / 左缘浮层 / 定位+高亮+自动展开 / 立项先行、编码下轮
- [x] 阈值数值复核（2026-09-04 开工时落定）：`maxDepth >= 2 || totalCards - 1 >= 3`——`totalCards` 含根卡，「追问 ≥3 条」即注册总数 ≥4；孙卡（嵌套 2 层）即时出现

## 阶段 1：纯逻辑（先测后 UI）

- [x] 新增 `chrome-extension/src/content/card-tree.tsx`：注册表 / 树构建 / 阈值 `shouldShowIndex` / 祖先链
- [x] `__tests__/card-tree.test.ts`（10 用例）：树构建顺序（含子先父后注册）、阈值边界（2 卡单层不出现、追问 3 卡出现、孙卡出现）、祖先链、环防御
- [x] 实现备注：Context 只放稳定 API，快照走 `useSyncExternalStore`（`useCardTreeSnapshot`）——渲染期读写 ref 会触发 react-hooks/refs 报错，且不稳定依赖会引发「重渲染→反复注册」循环

## 阶段 2：UI 与交互

- [x] `ExplainCard`：根卡挂 `CardTreeProvider`；每卡注册/注销（`getEl` + `expand()`；children 传 `cardId`/`parentId`）
- [x] 把手 + 浮层渲染（与卡片同级渲染避开 `overflow: hidden` 裁剪，随 `pos` 同步；把手右锚定贴左缘、贴屏左缘时压卡，均不出视口）
- [x] `jumpTo`：祖先链展开 → 双 rAF 等布局 → body 手动 `scrollTo` 定位（避免 `scrollIntoView` 连带滚动宿主页）→ `.crow-index-flash` 高亮 → `stopFollow()`
- [x] Esc（document 捕获 + stopPropagation，抢在 App 整卡关闭前）/ 浮层 × / 点击卡外收起；外点判定含索引层 `indexLayerRef`；卡片卸载即整体销毁，无残留

## 阶段 3：样式与回归

- [x] `styles.ts`：`.crow-tree-handle` / `.crow-tree-panel(-header/-close/-body)` / `.crow-tree-node(-text)` / `.crow-index-flash`（outline 动画，暗底/透明底通用）
- [x] 回归：保存 / 查重 / 折叠徽章 / 跟随滚到底链路未动（注册表只读快照，无行为耦合）
- [x] `npm run lint`（0 error）+ `npm run test`（72/72）+ `npm run verify` 全绿；扩展构建 OK；`npm run test:e2e:ext` 5/5（本机 3107 被占，用 `PORT=3117` 跑）

## 阶段 4：文档与交付

- [x] `docs/map/ext-content.md` 收录 `card-tree.tsx` + 更新 ExplainCard 行 + 新增两条坑
- [ ] `docs/product/chrome-extension.md`、`docs/tech/phase-2-chrome-extension.md` 定稿一句（结项时）
- [x] 扩展 E2E：既有 5 用例回归通过；索引用例按 qa.md 属可选，首版手测覆盖（T1~T12）
- [ ] PR → `dev`；Preview 验收后更新 `dev-preview-acceptance` 的 URL 与结论
