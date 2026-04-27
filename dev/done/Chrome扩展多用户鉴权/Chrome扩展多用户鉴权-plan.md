# Chrome 扩展多用户鉴权 — Plan

> 用户批准时间：2026-04-27
> 分支：`fea/chrome-ext-user-auth-tri`（已从 `dev` 切出）

## 目标

让 Chrome 扩展「存入笔记本」与站点多用户模型完全对齐，用户能以**三步以内**的操作完成「连接自己账号」，无需理解任何技术术语。

---

## [PM] 功能描述与价值

- **用户痛点**：扩展与网站是同一产品，用户期待划词后直接存进自己在网站上的笔记本，但实现上两个上下文互相隔离，之前靠 Admin Secret 绕过多用户边界。
- **本期核心体验**：
  1. 用户在 **网站登录**（已有能力）
  2. 笔记本页点「**连接插件**」按钮
  3. 扩展弹出/图标变为「✓ 已连接」
  4. 之后划词存笔记，数据进自己账号——与网页端完全同一份
- **用户对外看到的词**：「连接插件 / 已连接 / 重新连接」，**token / access_token / Bearer 等词对用户完全隐藏**。

---

## [TL] 技术方案（已确定）

### 通信机制：window.postMessage（content script 作桥）

```
Web 页面（已登录状态）
  → window.postMessage(
       { type: 'CROW_CONNECT_EXT', accessToken, apiBaseUrl: location.origin },
       location.origin            ← 同源过滤，阻断第三方窃听
    )
       ↓
content script（也运行在 Crow 站点页面上）
  → 校验 event.origin === Crow 站点 origin & event.source === window
  → chrome.storage.sync.set({ accessToken, apiBaseUrl })
  → window.postMessage({ type: 'CROW_CONNECT_EXT_OK' })
       ↓
扩展后续请求直接读取，无需用户手动配置任何内容
```

### 为什么不用中转 code

- `access_token` 本身已是短命凭证（Supabase 默认 ~1 小时），安全等级与网站 localStorage 里一致。
- 增加中转 code 需服务端存储 + 签发 + 校验，工程量 3 倍，安全收益接近零。
- postMessage 全程在「已信任的页面 → 本机 chrome.storage」，不过网络。

### 过期处理

- `POST /api/notes` 返回 401 时，`ExplainCard` 精确提示：「⚠️ 登录已过期，请回网站重新点「连接插件」」，并附跳转链接。

---

## 改动范围（确定）

| 模块 | 文件 | 改动摘要 |
|------|------|---------|
| Web — 连接按钮 | `components/AuthNav.tsx`（或 `app/notebook/page.tsx`） | 已登录时展示「连接插件」按钮；点击发 postMessage；收到 OK 回调后显示「✓ 已连接」 |
| 扩展 — content script | `chrome-extension/src/content/App.tsx` 或新增 message listener | 监听 `CROW_CONNECT_EXT`，写入 `chrome.storage.sync`，回传 OK |
| 扩展 — Options | `chrome-extension/src/options/Options.tsx` | 主界面改为「连接状态 + 去网站连接」；手动粘贴降级为备用/折叠区域 |
| 扩展 — ExplainCard | `chrome-extension/src/content/ExplainCard.tsx` | 401 时精确引导「回网站重新连接」，不再显示通用「请检查插件设置」 |
| 扩展 — Popup | `chrome-extension/src/popup/main.tsx` | 用 `accessToken` 判断「已连接/未连接」（已完成，无需额外改） |
| 扩展 — manifest | `chrome-extension/manifest.json` | 版本已更新至 0.1.1（已完成） |

**工作量估算**：~80 行核心改动，1 个小迭代。

---

## 明确不做（本期）

- 扩展内嵌完整登录流（C 档，Supabase PKCE / chrome.identity）
- postMessage 以外的加密/中转层
- 令牌快过期的静默探测（后续增量）
- 游客模式在扩展内暂存本机笔记

---

## [Decision]

1. 扩展侧 Bearer 对接 ✅（已在分支上完成）
2. Web 端「连接插件」按钮 + content script 接收存储 → **待开发**
3. 扩展 Options 改为连接状态界面；401 精确引导 → **待开发**
4. QA 覆盖：无 token、错误 token、401 过期、同账号数据一致 → **待 QA 阶段**
