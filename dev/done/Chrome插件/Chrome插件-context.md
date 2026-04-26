# Chrome 插件 — 上下文记录

## 关键决策

### Shadow DOM 隔离
content script 注入的 UI 必须用 Shadow DOM，否则页面的 CSS 会污染插件 UI（字体、颜色、z-index 等）。
host 元素 `pointer-events: none`，实际 UI 元素 `pointer-events: auto`。

### CORS 问题
Chrome Extension content script 在 MV3 中发 cross-origin fetch，服务端必须返回正确 CORS 头：
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Headers: Content-Type, x-admin-secret`
- OPTIONS preflight 需要单独处理

### 为什么不用 CRXJS 以外的方案
@crxjs/vite-plugin@2.0.0-beta.26 + Vite 5 是目前最成熟的 MV3 + Vite 方案。
它自动处理 content script 打包为单文件、background ESM、HTML 页面等。

### 流式请求
/api/explain 返回 ReadableStream（不是 SSE），直接 getReader().read() 消费即可。
Extension 的 useStreamExplain 和 Web 端逻辑一致，只是 URL 改为绝对路径。

### 配置存储
用户在 Options 页填写的 `apiBaseUrl` 和 `adminSecret` 存入 `chrome.storage.sync`。
ExplainCard 保存笔记时从 storage 读取 adminSecret。

## 依赖的运行时配置
chrome.storage.sync 结构：
```typescript
interface ExtensionConfig {
  apiBaseUrl: string;   // e.g. https://open-crow-tool.vercel.app
  adminSecret: string;
}
```

## 已知的 Vercel URL
https://open-crow-tool.vercel.app
