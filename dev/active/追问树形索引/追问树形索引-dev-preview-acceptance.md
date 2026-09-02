# 追问树形索引 — Vercel Preview（dev）验收

> **Preview URL**：`<!-- TODO: 合入 dev 后由 Vercel Dashboard 取本次 Deployment 链接替换 -->`
>
> **前置**：Preview 站点可用；Chrome 加载已构建的 `chrome-extension/`（`npm ci && npm run build`，构建时 `VITE_PUBLIC_SITE_URL` 指向该 Preview），并在 Options 登录或由站点「连接插件」。

## 最小路径

1. 任意网页划词 → 解释卡出现 → 连续追问 3 条：左缘出现索引把手；追问仅 1 条时不出现。
2. 任一子卡内再追问（出现孙卡）→ 点把手展开浮层：树按层级缩进、长问题两行截断。
3. 先折叠某张子卡，再点它对应节点：卡片自动展开、平滑定位并橙色高亮一瞬；视图不被拉回底部。
4. 保存笔记 / 查重（都保留、覆盖）与关闭卡片后重划：链路无回归、无残留节点。

## 结论

- 日期：待验收 ｜ 结论：PASS / FAIL（备注）
