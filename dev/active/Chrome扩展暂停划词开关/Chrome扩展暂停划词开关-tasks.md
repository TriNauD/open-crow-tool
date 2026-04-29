# Chrome 扩展暂停划词开关 — Tasks

> **排期**：待 `Chrome扩展插件内refresh` 合并入 `dev` 后再从 `dev` 切分支；下方「开发准备」届时打勾。

## 开发准备

- [ ] 合并基线就绪后：`git checkout dev && git pull && git checkout -b fea/chrome-ext-pause-toggle-<owner>`
- [ ] 回填本文件顶部实际分支名

## 实现

- [ ] `chrome.storage.local`：`crow_extension_enabled`（默认 true；缺省按 true 处理）
- [ ] `content/index.tsx`：`mount()` 受开关 gate；`onChanged` 动态挂载/卸载 App；**保持** `CROW_CONNECT_EXT` 桥接始终可用
- [ ] `background`：快捷键 `CROW_EXPLAIN` 在关闭时不触发解释（与 plan 选定方案一致）
- [ ] `popup`：开关 UI + 读写 storage
- [ ] `options`：同一开关 + 简短说明
- [ ] `manifest`：若需版本号递增，随发布惯例

## 文档

- [ ] `docs/product/chrome-extension.md`：补充「暂停划词」一句
- [ ] `docs/tech/phase-2-chrome-extension.md` 或 `environments-and-deployment.md`：如需注明测试习惯，可添一句

## QA / 收尾

- [ ] 手测：见 plan QA 摘要
- [ ] `npm run lint` / `verify` 通过
- [ ] 结项：`dev/done/…`、`tasks` 全勾、PM 审核（按 `dev-workflow`）
