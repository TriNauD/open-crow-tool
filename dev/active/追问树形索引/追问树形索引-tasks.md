# 追问树形索引 — Tasks

> 分支：`fea/ext-card-tree-index-tri` → PR → `dev`
> 手测：[`追问树形索引-qa.md`](./追问树形索引-qa.md)；Preview 最小路径：[`追问树形索引-dev-preview-acceptance.md`](./追问树形索引-dev-preview-acceptance.md)

## 阶段 0：定稿

- [x] 四项决策经用户确认（2026-09-03）：阈值出现 / 左缘浮层 / 定位+高亮+自动展开 / 立项先行、编码下轮
- [ ] 阈值具体数值复核（`maxDepth >= 2 || totalCards >= 3`），开发首日如有异议先改本行再动码

## 阶段 1：纯逻辑（先测后 UI）

- [ ] 新增 `chrome-extension/src/content/card-tree.tsx`：注册表 / 树构建 / 阈值 `shouldShowIndex` / 祖先链
- [ ] `__tests__/card-tree.test.ts`：树构建顺序、阈值边界（2 卡单层不出现、3 卡出现、孙卡出现）、祖先链展开顺序

## 阶段 2：UI 与交互

- [ ] `ExplainCard`：根卡挂 `CardTreeProvider`；每卡注册/注销（含 `el` 与 `expand()`）
- [ ] 把手 + 浮层渲染（portal 到卡片外，与 `pos` 同步；clamp 越界）
- [ ] `jumpTo`：祖先展开 → `scrollIntoView` → `.crow-index-flash` 高亮 → `stopFollow()`
- [ ] Esc / 点击浮层外收起；卡片关闭时资源清理（无残留 portal 节点、监听器）

## 阶段 3：样式与回归

- [ ] `styles.ts`：`.crow-tree-handle` / `.crow-tree-panel` / `.crow-tree-node` / `.crow-index-flash`
- [ ] 回归：保存笔记 / 查重 / 折叠徽章（含子卡折叠）/ 跟随滚到底，均不受注册表影响
- [ ] `npm run lint` + `npm run test`；`chrome-extension/` 构建

## 阶段 4：文档与交付

- [ ] `docs/map/ext-content.md` 收录 `card-tree.tsx` + 更新 ExplainCard 行
- [ ] `docs/product/chrome-extension.md`、`docs/tech/phase-2-chrome-extension.md` 定稿一句
- [ ] 扩展构建后跑 `npm run test:e2e:ext`（若加了索引用例）
- [ ] PR → `dev`；Preview 验收后更新 `dev-preview-acceptance` 的 URL 与结论
