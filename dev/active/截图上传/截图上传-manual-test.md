# 截图上传 — 保姆级手动测试

> 合入 `fea/future-features` 后。自动化：`npm run test`（`image-limits` / explain-prompt hasImage）。

## 环境

| 项 | 说明 |
|----|------|
| 分支 | `fea/future-features` → `npm run dev` |
| **Vision 模型** | `.env.local` 的 `AI_MODEL` 须支持看图（如 `gpt-4o` 且 `AI_PROVIDER=openai`）。默认 DeepSeek Flash **不能**看图，会 500 并提示 vision。 |
| 浏览器 | 桌面 Chrome；可复制截图到剪贴板 |

## A. 粘贴截图

1. 截一张含界面/术语的图到剪贴板。
2. 首页输入框 **Cmd/Ctrl+V**。  
   **预期**：出现缩略预览 +「移除截图」；可再补一行说明文字。
3. 点「这是啥？」或 Enter。  
   **预期**：卡片标题带 `[截图]`；流式解释针对图内容。
4. Network → `POST /api/explain`。  
   **预期**：body 含 `image.mimeType` + `image.dataBase64`（体积经压缩，不应是数 MB 原图）。

**失败看哪里**：无预览 → paste 被浏览器拦或非 image/*；500 含 vision 提示 → 换模型；413/过大 → 压缩后仍超限，换更小图。

## B. 选文件上传

1. 点输入区「截图」→ 选 png/jpg。  
   **预期**：同 A 的预览与发送。

## C. 纯文本回归

1. 不带图，输入 `RAG 是啥` 发送。  
   **预期**：与改前一致；body **无** `image`。

## D. 保存笔记

1. 带图解释完成后保存。  
   **预期**：笔记本 `inputText` 类似 `（图片）…` 或 `（图片说明）`，**无**原图二进制。

## 结论

| 日期 | AI_MODEL | 结论 | 备注 |
|------|----------|------|------|
| | | PASS / FAIL | |
