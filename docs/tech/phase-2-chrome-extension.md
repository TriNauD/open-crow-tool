## 五、Phase 2：Chrome 插件

### 目录结构

```
chrome-extension/
  manifest.json
  src/
    content/
      index.tsx          — content script 入口；**顶层**注册 `CROW_CONNECT_EXT` 桥接 + 选词/mount
      FloatingButton.tsx — 选词后出现的橙色按钮
      ExplainCard.tsx    — 解释气泡卡片（复用 Web 端逻辑）
      useStreamExplain.ts — 复制自 hooks/，调整 fetch URL 为绝对路径
    background/
      index.ts           — service worker，处理 Alt+W 快捷键
    options/
      index.tsx          — Options 页面，展示连接状态；可手动改 API URL / token 备用
      Options.tsx
    popup/
      index.tsx          — 点击插件图标的小 popup（非主要功能）
  vite.config.ts
  tsconfig.json
  package.json
```

### manifest.json 关键配置

```json
{
  "manifest_version": 3,
  "name": "这是啥？",
  "permissions": ["storage", "activeTab", "scripting", "commands"],
  "commands": {
    "explain-selection": {
      "suggested_key": { "default": "Alt+W" },
      "description": "解释选中文字"
    }
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["src/content/index.js"]
  }],
  "options_ui": {
    "page": "options.html",
    "open_in_tab": true
  }
}
```

### 插件交互逻辑

```
用户选中文字
    ├── 浮动按钮出现（选中文字旁边，用 getBoundingClientRect 定位）
    │       └── 点击按钮 → 触发解释
    └── 按 Alt+W → background service worker → 发消息给 content script → 触发解释

触发解释：
    → 获取选中文字
    → 在选中文字旁边挂载 ExplainCard 组件（React Portal）
    → fetch 到 Web 端 /api/explain（URL 从 chrome.storage.local 的 apiBaseUrl 读取）
    → 流式渲染解释内容
    → 用户点"存入笔记本" → fetch /api/notes（`Authorization: Bearer`，与 CORS/预检一致）
    → 用户点击卡片外部 / 按 Esc → 卸载卡片
```

### 鉴权配置存储

```typescript
// chrome.storage.local（CrowAuth，与网站 Session 一致；由 postMessage 桥接或扩展内登录写入）
interface CrowAuth {
  apiBaseUrl: string;
  accessToken: string;
  refreshToken: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  expiresAt?: number;
}
```

网站 `AuthNav` 可发 `postMessage({ type: 'CROW_CONNECT_EXT', … })`；**C-3** 扩展内登录成功后将写入同一 `CrowAuth` 形态（与网站桥接互斥于「最后一次写入为准」）。`lib/utils/cors.ts` 的 `Access-Control-Allow-Headers` 须含 `Authorization`（跨域 `POST /api/notes` 预检）。扩展内在请求前使用 `ensureFreshAuth` 刷新 access token。立项文档：[`dev/active/Chrome扩展内登录/`](../../dev/active/Chrome扩展内登录/)。

