<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:code-map-rules -->
# 代码地图（开工 / 收工必读）

- **开工**：先读 `docs/map/README.md`（模块一览 + 全局接缝 + 平行实现警示），再按改动点读对应分卷：`docs/map/web-api.md`、`docs/map/web-ui.md`、`docs/map/lib-core.md`、`docs/map/ext-content.md`、`docs/map/ext-platform.md`。仅当地图未覆盖目标代码时才派子代理探查，且探查结论必须回写地图对应分卷。
- **收工**：本次改动涉及的分卷必须同步更新（文件增删、职责变化、新发现的坑）。`scripts/check-map.mjs` 挂在 `npm run verify` 与 CI——分卷里列出的文件不存在、或源码目录出现未收录的 `.ts/.tsx/.sql` 文件时，构建直接红。
<!-- END:code-map-rules -->
