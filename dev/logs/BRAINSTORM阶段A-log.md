# BRAINSTORM 需求池 — 阶段 A 结项记录

> 功能分支：`fea/brainstorm-phase-a-tri`（建议）  
> 结项文档目录：`dev/done/BRAINSTORM阶段A/`  
> 验收：**PASS** — 见该目录 `阶段A-qa.md` §4（2026-04-28）  
> **需求池总索引**（含 B/C/D 未启动条目）：[`dev/active/BRAINSTORM需求池/README.md`](../active/BRAINSTORM需求池/README.md)

## 交付摘要

- **Web（A-1）**：首页「发送」快捷键角标按平台显示（Mac `⌘↵`，Win/Linux `Ctrl+Enter`，手机不展示）；`lib/keyboard-send-hint.ts`；多页表单类控件 `text-base md:text-sm` 减轻 iOS 聚焦缩放。**Vitest + Playwright（E2E-A1-01〜04）**覆盖。
- **扩展（A-2）**：划词卡片 footer「打开笔记本」，新标签打开 `{apiBaseUrl}/notebook`，`target="_blank"`、`rel="noreferrer"`。
- **工程**：`npm run dev:lan`（局域网真机）；`@playwright/test`、根目录 `playwright.config.ts`、`e2e/`；CI：`build` → `playwright install` → `test:e2e`。

## 风险与回滚

- **风险等级**：Low（文案 + 扩展链接；不改 API 契约）。
- **回滚**：还原 `app/page.tsx`、`lib/keyboard-send-hint.ts`、`ExplainCard.tsx` 及相关样式即可；移除 E2E 需同步删 CI 步骤与脚本（若非整 PR 回滚）。

## 已知非阻塞说明

- **TC-A1** Win/Linux **实机**两行未手点，已由 **E2E-A1-02** 与 Vitest 背书（见 QA **TC-A1** 表）。

## 关联文件（便于复盘）

- `playwright.config.ts`、`e2e/a1-home-send-shortcut-hint.spec.ts`
- `scripts/dev-lan.mjs`
- `docs/product/chrome-extension.md`（「打开笔记本」一行）
