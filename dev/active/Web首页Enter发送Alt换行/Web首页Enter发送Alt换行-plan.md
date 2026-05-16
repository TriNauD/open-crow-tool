# Web 首页 Enter 发送 / Alt+Enter 换行 — 技术方案

## 行为

| 按键 | 行为 |
|------|------|
| Enter（非组合键） | `preventDefault` + `submitQuery` |
| Alt+Enter / Shift+Enter | 默认 textarea 换行 |
| ⌘/Ctrl+Enter | 与 Enter 相同（发送） |
| IME 组合中 Enter | 不拦截 |

## 涉及文件

- `app/page.tsx`：`onKeyDown` 逻辑。
- `lib/keyboard-send-hint.ts`：桌面角标改为「Enter 发送 · Alt+Enter 换行」类文案；Mac 用 `↵` / `⌥↵` 与既有符号风格一致。
- `__tests__/keyboard-send-hint.test.ts`：断言新文案（可 mock `navigator`）。
- `e2e/a1-home-send-shortcut-hint.spec.ts`：E2E-A1 期望文案随产品变更更新。

## 风险

低。需注意 hydration：hint 仍在 `useEffect`/`queueMicrotask` 后设置，与阶段 A 一致。

## 验证

- `npm run lint`、`npm run test`。
- 扩展相关 E2E 若 CI 未强制可跳过；改动首页与共享 lib  hint，跑 Vitest + 首页 E2E 即可。
