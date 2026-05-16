# Web 首页 Enter 发送 / Alt+Enter 换行 — 背景

## 背景

当前首页主输入框为 **⌘/Ctrl+Enter** 发送，**Enter** 插入换行。产品希望与常见对话类产品对齐：**Enter** 一键发送，**Alt+Enter** 明确换行。

## 约束

- 仅 **Web 首页** `app/page.tsx` 主 textarea；扩展与其它页面不动。
- **移动端**仍不展示桌面快捷键角标（沿用 `lib/keyboard-send-hint.ts` UA 规则）。
- **中文输入法**：组合键进行中不按 Enter 发送（`nativeEvent.isComposing`）。

## [Decision]

- **发送**：`Enter`，且非 IME 组合态；保留 **⌘/Ctrl+Enter** 仍可发送，兼容老习惯。
- **换行**：**Alt+Enter**；另允许 **Shift+Enter** 换行（与常见聊天应用一致，降低误发整段文字的概率）。
