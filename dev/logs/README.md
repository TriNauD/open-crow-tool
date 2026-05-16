# `dev/logs/` — 发布、需求与 Bug 记录

本目录放**可追溯**的变更与问题记录：按**主题**分文件（如 `周报邮件-log.md`），与 `dev/active`、`dev/done` 里的需求对应或独立存在均可。

## 何时新建 vs 追加

- **新建** `dev/logs/<主题>-log.md`：新需求结项、重大专项、或**独立 Bug** 无双可挂靠模块时。
- **追加**：Bug 或迭代属于**已有主题**（例如周报相关就写进 `周报邮件-log.md`），在同一文件末尾按 **BF-n** 递增编号。

**Bug 分支与流程**：见 `.cursor/rules/dev-workflow.mdc`「Bug 修复流程」；合并入 `dev` 后（或 PR 内仅文档 commit）**必须**补 BF。

---

## BF-n 存档模板（复制使用）

每条 Bug  fix 至少包含下面四要素；可按需加 **PR 链接**、截图说明、环境（Preview / Production）。

```markdown
### BF-<n>：<一句话标题>（<YYYY-MM-DD>）

- **现象**：用户/系统层面看到什么；如何复现（步骤或条件）。
- **根因**：技术原因一句话 + 必要时展开；若未完全确认写「待证」并备注假设。
- **涉及文件**：`path/to/file.ts`（列出关键改动路径即可）。
- **验证**：如何确认已修好（命令、手测步骤、或「已跑 `npm run test` / E2E xx」）。
- **分支 / PR**（可选）：`bugfix/xxx` → #123
```

**编号**：同一 `*-log.md` 内 **BF-1、BF-2…** 顺序递增；不要跨文件重置编号（各文件独立计数）。

**生产 hotfix**：除上述内容外，建议在 **验证** 中注明 smoke 或观察窗口（与 `release-and-hotfix.mdc` 一致）。

---

## 与产品管道的关系

`product-delivery-pipeline.mdc` 步 5 要求 BF 四要素与本模板一致；结项时可在对应 `dev/done/…/tasks.md` 或本目录 log 中写明结论。
