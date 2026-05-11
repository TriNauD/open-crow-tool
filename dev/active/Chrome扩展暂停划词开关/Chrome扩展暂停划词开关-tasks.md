# Chrome 扩展暂停划词开关 — Tasks

> PR [#27](https://github.com/TriNauD/open-crow-tool/pull/27) 已合并到 dev

## 开发准备

- [x] 合并基线就绪后：`git checkout dev && git pull && git checkout -b fea/chrome-ext-pause-toggle-wesrindo`
- [x] 回填本文件顶部实际分支名

## 实现

- [x] `chrome.storage.local`：`crow_extension_enabled`（默认 true；缺省按 true 处理）
- [x] `content/index.tsx`：`mount()` 受开关 gate；`onChanged` 动态挂载/卸载 App；**保持** `CROW_CONNECT_EXT` 桥接始终可用
- [x] `background`：快捷键 `CROW_EXPLAIN` 在关闭时不触发解释（与 plan 选定方案一致）
- [x] `popup`：开关 UI + 读写 storage
- [x] `options`：同一开关 + 简短说明
- [ ] `manifest`：若需版本号递增，随发布惯例

## 文档

- [ ] `docs/product/chrome-extension.md`：补充「暂停划词」一句
- [ ] `docs/tech/phase-2-chrome-extension.md` 或 `environments-and-deployment.md`：如需注明测试习惯，可添一句

## QA / 收尾

- [x] `tsc --noEmit` 通过（主应用 + Chrome 扩展）
- [x] `npm run lint` 通过
- [ ] 手测：见 `Chrome扩展暂停划词开关-qa.md` §0.2
- [ ] 结项：`dev/done/…`、`tasks` 全勾、PM 审核（按 `dev-workflow`）
