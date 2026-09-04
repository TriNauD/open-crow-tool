# Web 首页 Enter 发送 — QA

## 影响域

- **模块**：Web 首页输入、`lib/keyboard-send-hint`。
- **风险**：低（交互变更；扩展无涉）。

## §0.2 自动化对表

| ID | 类型 | 说明 |
|----|------|------|
| E2E-A1-01〜04 | Playwright | `e2e/a1-home-send-shortcut-hint.spec.ts`（文案随 Enter/Alt 策略更新） |
| Vitest | 单元 | `__tests__/keyboard-send-hint.test.ts` |

## 功能测试

1. **桌面**：单行输入按 **Enter** → 触发解释卡片（与按钮「这是啥？」一致）；**Alt+Enter** → 框内多行、不发送。
2. **Shift+Enter** → 换行，不发送。
3. **⌘/Ctrl+Enter** → 仍可发送（回归）。
4. **移动端 / 窄屏**：不出现 `home-send-shortcut-hint`（伪 UA 见 E2E-A1-04）。
5. **IME**：中文拼音未确认时 Enter 选词 — 不应误触发发送（手测）。

## 回归

- 首页示例 pill、按钮发送不受影响。

## 结论

- [ ] PASS / [ ] FAIL（日期：）
