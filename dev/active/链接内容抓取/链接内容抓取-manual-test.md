# 链接内容抓取 — 保姆级手动测试

## 环境

`fea/future-features` → `npm run dev`。接口：`POST /api/fetch-url`（公开，与 explain 同级；勿对内网测生产）。

## A. 正常公开页

1. 首页粘贴公开博客 URL（`https://…`）。  
   **预期**：出现「读取链接」按钮。
2. 点「读取链接」。  
   **预期**：生成一条解释卡片，query 含「正文摘要」；解释引用页面要点。
3. Network：`POST /api/fetch-url` → 200，`data.text` 非空。

## B. SSRF / 危险 URL

逐条粘贴并点「读取链接」（或直接调 API）：

| URL | 预期 |
|-----|------|
| `http://127.0.0.1/` | 失败，code 含 `SSRF_BLOCKED` |
| `http://localhost/` | 同上 |
| `ftp://example.com` | 拒绝 |
| `http://user:pass@example.com` | 拒绝 |

**预期**：页面显示错误文案，**不**白屏。

## C. 纯文本回归

输入普通词「RAG」发送（不点读取链接）→ 行为不变。

## 结论

| 日期 | 结论 | 备注 |
|------|------|------|
| | PASS / FAIL | |
