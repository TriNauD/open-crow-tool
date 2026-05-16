# Chrome 扩展暂停划词开关 — Tasks

> PR [#27](https://github.com/TriNauD/open-crow-tool/pull/27) 已合并到 dev；后续迭代以 `bugfix/ext-explain-without-auth-wesrindo` 合入 `dev`（2026-05-16）结束。

## 开发准备

- [x] 合并基线就绪后：`git checkout dev && git pull && git checkout -b fea/chrome-ext-pause-toggle-wesrindo`
- [x] 回填本文件顶部实际分支名

## 实现

- [x] `chrome.storage.local`：`crow_extension_enabled`（默认 true；缺省按 true 处理）
- [x] `content/index.tsx`：`mount()` 受开关 gate；`onChanged` 动态挂载/卸载 App；**保持** `CROW_CONNECT_EXT` 桥接始终可用
- [x] `background`：快捷键 `CROW_EXPLAIN` 在关闭时不触发解释（与 plan 选定方案一致）
- [x] `popup`：开关 UI + 读写 storage
- [x] `options`：同一开关 + 简短说明
- [x] `manifest`：版本号随发布惯例由维护者递增；本需求迭代以构建验证为准

### 验收后 Follow-up（2026-05）

- [x] 未连接也可划词解释；保存时再引导连接插件（`App.tsx` / `ExplainCard.tsx`）
- [x] 扩展重载/卸载后清除僵尸 UI；旧标签页与开关实时同步（`onInstalled` 补注入 + 心跳，`index.tsx` / `background/index.ts`）

## 文档

- [x] `docs/product/chrome-extension.md`：暂停划词与后续行为已结项表述
- [x] `docs/tech/phase-2-chrome-extension.md`：运行时 gate / 补注一句
- [x] `dev/logs/Chrome扩展暂停划词开关-log.md`：结项与 BF 记录

## QA / 收尾

- [x] `tsc --noEmit` 通过（主应用 + Chrome 扩展）
- [x] `npm run lint` 通过
- [x] 手测：见 `Chrome扩展暂停划词开关-qa.md` §0.2 — **PASS**（2026-05-16，用户 sign-off）
- [x] 结项：`dev/done/…`、log、`docs` 索引已更新
