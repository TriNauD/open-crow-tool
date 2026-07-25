# 划词上下文 — 保姆级手动测试

> 合入 `fea/future-features` 后使用。自动化：`npm run lint`、`npm run test`（含 `__tests__/explain-prompt.test.ts`）；扩展改动建议本地 build 后手测。

## 环境

| 项 | 说明 |
|----|------|
| Web API | 本地 `npm run dev`（或 future 部署的 API Base） |
| 扩展 | `cd chrome-extension && npm ci && npm run build`，Chrome 加载 `chrome-extension/dist` |
| Options | 扩展 Options 里 API Base 指向上述 Web；可不登录（解释公开） |
| 账号 | 测保存时再登录；本需求核心是解释请求是否带 surrounding |

## A. 普通网页短词（主路径）

1. 打开任意**普通文章页**（非 PDF、非跨域 iframe 内文），找一句长句里的短词（如「RAG」「token」）。
2. 划选该短词 → 点浮标「这是啥」或 Alt+W。  
   **预期**：弹出解释卡片并开始流式输出。
3. 打开 DevTools → Network → 找到 `POST …/api/explain`。  
   **预期**：Request Payload 含：
   - `text`: 你的选区
   - `surroundingText`: 非空字符串，含选区前后文（中间可有 `【…】`），**不必**整页 HTML
4. 读解释内容（抽样）。  
   **预期**：短词解释符合句意（相对无上下文时更贴切即可，不要求完美）。

**失败看哪里**：Payload 无 `surroundingText` → content script 截取失败或未 rebuild；有 surrounding 但解释离谱 → 看 prompt（服务端日志 / 临时加 log）；CORS / 404 → API Base。

## B. 截取失败降级

1. 在**跨域 iframe** 内划词（若可），或 PDF Chrome viewer 内划词。  
   **预期**：仍能解释选区；Payload **可以没有** `surroundingText`（或为空被省略）；**不**因截取失败整卡报错。

## C. Web 首页追问回归

1. 浏览器打开 Web 首页（非扩展），问一个概念 → 对答案里某词「钻取/追问」（若产品有此入口）。  
   **预期**：仍走 `context`=父解释；**不**误伤；Network 里 `context` 有值，通常无 `surroundingText`。

## D. 保存笔记（不存 surrounding）

1. 扩展解释完成后登录保存。  
   **预期**：笔记本里只有选区文本 + 解释；**不要求**存 surrounding。

## 结论

| 日期 | API / 扩展版本 | 结论 | 备注 |
|------|----------------|------|------|
| | | PASS / FAIL | |
