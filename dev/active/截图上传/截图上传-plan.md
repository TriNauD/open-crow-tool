# 截图上传 — Plan

> **分支建议**：`fea/screenshot-multimodal-tri`  
> **池条目**：C-2

## 目标

1. Web 首页支持粘贴/选择截图，走多模态解释并流式展示。
2. 限制体积与频率；失败时友好降级。
3. 保存笔记本时：MVP 可只存「用户备注/OCR 文本 + 解释」，**或**存「（图片说明）+ 解释」——阶段 0 定；默认不强制存原图。

## 非目标

- 扩展 tab 截图、图床长期相册、多图对话历史。
- 用截图替代划词主路径。

---

## [PM] 验收要点（草案）

- 粘贴 png/jpeg 出现缩略预览，点发送后出流式解释。
- 超大图有压缩或明确错误，不白屏。
- 纯文本路径回归不受影响。
- 未配置 vision 模型时：清晰错误，不挂死。

---

## [TL] 技术方案

### 请求契约（草案）

```json
POST /api/explain
{
  "text": "可选，用户补充说明",
  "context": "可选",
  "image": { "mimeType": "image/png", "dataBase64": "..." }
}
```

- 服务端：校验 mime/大小 → 转 provider 多模态 message（OpenAI 兼容 `image_url` data URL）。
- `buildExplainPrompt`：无图走旧逻辑；有图则 user 内容改为「看图解释图中概念/工具，用户补充：…」。

### UI

- `app/page.tsx`：隐藏 file input + `onPaste` 截获 image；缩略图可移除。
- 发送时带上 image；清空时释放 object URL。

### 涉及文件（预估）

- `app/page.tsx`、`hooks/useStreamExplain.ts`
- `app/api/explain/route.ts`、`lib/ai/prompts.ts`、`lib/ai/providers.ts`
- 可选：`lib/ai/image-limits.ts`（常量与校验）
- `docs/product/web-explainer.md`、`docs/tech/overview.md`（一句）
- 环境：确认 primary 模型支持 vision（`.env.local.example` 注释，无真实密钥）

### 风险与回滚

- Body 过大被平台拒：压缩 + 降分辨率。
- 回滚：忽略 `image` 字段；UI 隐藏入口。

---

## [QA] 影响域

- 解释主链路、CORS（扩展若误传大图——MVP 扩展不发图）、笔记本保存字段。

## [Decision]

- MVP：**Web + inline 压缩图 + vision 模型**；不落长期 Storage。
