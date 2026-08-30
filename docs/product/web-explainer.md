# Web 解释器（模块 A，MVP+）

> 原 PRD「二、三大功能模块 → 模块 A」

用户在网站上输入或粘贴任意文字/链接，AI 用大白话流式返回解释。

**核心功能：**
- 文本输入 + 流式 AI 解释
- 在答案中划词递归追问（"这又是啥"）
- 解释结果存入笔记本（云端持久化）
- 笔记本支持搜索、查看、删除

**体验要求：**
- 响应要快，流式输出不能卡
- 移动端可用（但不是重点优化对象）
- UI 简洁，信息密度合适，不花哨

**迭代（解释卡片复制/重试 ✅ 2026-08-31，Web 端先行）：**
- **复制**：解释完成后一键复制完整纯文本，「已复制」提示 2s
- **重试**：请求失败时红字旁出现「重试」，原样重发同一请求重新进入流式态（`useStreamExplain` 记录最近一次入参）
- 扩展端 `ExplainCard` 对表跟进；AI 调用侧配套加了 18s 连接超时与 provider 自动切换（见 `dev/logs` BF-2）

**迭代（触屏 Enter 换行，2026-08-31，R7）：** 触屏设备（`pointer: coarse`）上 Enter 不再被拦截——一律换行，发送仅靠按钮；桌面键位不变，角标文案移动端维持隐藏。分支 `fea/mobile-enter-newline`。

**迭代说明（BRAINSTORM 阶段 A ✅，2026-04）：**  
首页输入区快捷键提示按操作系统显示（Mac `⌘↵` / Win/Linux `Ctrl+Enter`，手机浏览器不展示）；关键输入控件使用足够字号以免 iOS 聚焦时整页缩放。归档：`dev/done/BRAINSTORM阶段A/阶段A-plan.md`、`阶段A-qa.md`。**需求池**（含后续阶段条目）：[`dev/active/BRAINSTORM需求池/README.md`](../../dev/active/BRAINSTORM需求池/README.md)。

**迭代（Web 首页 Enter 发送，进行中）：** **Enter** 发送；**Alt+Enter** 换行（另 **Shift+Enter** 换行）；**⌘/Ctrl+Enter** 仍可发送；桌面角标为 `↵ 发送 · ⌥↵ 换行`（Apple）或 `Enter 发送 · Alt+Enter 换行`（Win/Linux）；手机仍不展示角标。立项：[ `dev/active/Web首页Enter发送Alt换行/`](../../dev/active/Web首页Enter发送Alt换行/)。

**BRAINSTORM（已合 `fea/future-features`，暂不合 `dev`）**：名词解释与消歧（`DISAMBIGUATION_RULES`）[`名词解释与消歧/`](../../dev/active/名词解释与消歧/)；截图多模态（首页粘贴/选图 → `/api/explain` image，需 vision 模型）[`截图上传/`](../../dev/active/截图上传/)；链接正文抓取（`POST /api/fetch-url`）[`链接内容抓取/`](../../dev/active/链接内容抓取/)。接手见 [FUTURE-FEATURES-HANDOFF](../../dev/active/BRAINSTORM需求池/FUTURE-FEATURES-HANDOFF.md)。
