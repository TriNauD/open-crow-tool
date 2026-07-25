# Chrome 扩展内登录 — 保姆级手动测试

> 合入 `fea/future-features` 后使用。方案 **A**：Options 内邮箱密码 → GoTrue password grant → `persistCrowAuth`（含 refresh）。网站「连接插件」保留。

## 环境

| 项 | 说明 |
|----|------|
| Web | 本地 `npm run dev`（如 `http://localhost:3000`），或与扩展构建目标一致的 Preview |
| 扩展构建 | `cd chrome-extension && npm ci && npm run build`；`.env` 须含与网站一致的 `VITE_PUBLIC_SUPABASE_URL` / `VITE_PUBLIC_SUPABASE_ANON_KEY`，以及 `VITE_PUBLIC_SITE_ORIGIN`（本地测可填 `http://localhost:3000`） |
| 加载扩展 | Chrome → `chrome://extensions` → 开发者模式 →「加载已解压的扩展程序」→ 选 `chrome-extension/dist`；改代码后需 **重新 build + 点扩展「重新加载」** |
| 测试账号 | 已在网站注册且**邮箱已验证**的账号（与网站登录同一套） |
| 勿写入文档 | 真实密码、anon key、JWT |

打开 Options：扩展图标 →「打开设置」，或 `chrome-extension://<扩展ID>/src/options/index.html`。

---

## A. 扩展内登录 → 存笔记（主路径）

1. 打开扩展 Options。  
   **预期**：状态为「尚未登录」；可见邮箱/密码表单与橙色「登录」；「高级选项」默认折叠。
2. 填入正确邮箱与密码 → 点「登录」。  
   **预期**：短暂「登录中…」后状态变为「插件已连接到你的账号」，并显示 API 地址（与 `VITE_PUBLIC_SITE_ORIGIN` 一致）；密码框清空；不出现令牌明文。
3. 任意普通网页划词 → 点浮标 → 等解释完成 → 点「存入笔记本」。  
   **预期**：保存成功（或出现重复确认后仍可存）；笔记本（网站）可见该条。
4. （可选）Options 点「刷新状态」。  
   **预期**：仍为已连接；提示「连接状态已更新」类成功文案时可忽略细节。

**失败看哪里**

| 现象 | 查看 |
|------|------|
| 「扩展未配置登录服务」 | `chrome-extension/.env` 是否写入并 **重新 build** |
| 「邮箱或密码不正确」 | 用同一账号在网站 `/login` 验证；确认邮箱已确认 |
| 「邮箱尚未验证」 | 邮箱收确认信；在网站完成验证后再试 |
| 「网络异常」 | Options 页 DevTools → Network，是否请求 `…/auth/v1/token?grant_type=password`；CORS/广告拦截 |
| 登录成功但存笔记 401 | Options 里 API 地址是否指向当前 Web；Network 看 `POST /api/notes` 的 Authorization |
| 登录成功但 API 地址不对 | 改 `.env` 的 `VITE_PUBLIC_SITE_ORIGIN` 后 rebuild，或高级区手动改地址 |

---

## B. 退出登录

1. Options 已登录时点「退出登录」。  
   **预期**：状态回到「尚未登录」；再次划词存笔记时底部为「登录后可保存」。
2. Popup（点扩展图标）  
   **预期**：提示「尚未登录，请打开设置登录账号」。

---

## C. 网站「连接插件」回归

1. Options **退出登录**（或清除扩展 storage）。
2. 打开与 `apiBaseUrl` 一致的网站 → 登录 → 点导航「连接插件」。  
   **预期**：网站短暂显示「✓ 插件已连接」类反馈。
3. 打开或切回扩展 Options。  
   **预期**：显示「插件已连接到你的账号」；可出现「已通过网站同步连接状态」。
4. 划词 → 存笔记。  
   **预期**：成功（与改前行为一致）。

**失败看哪里**：网站 Console 是否有 postMessage；扩展 content 是否加载；`chrome.storage.local` 是否有 `accessToken` / `apiBaseUrl`（Application → Extension storage）。

---

## D. 后写覆盖（两种入口先后）

1. 先走 **A** 扩展内登录成功。
2. 换另一测试账号在网站登录 → 点「连接插件」。  
   **预期**：Options 反映**网站账号**（API 地址为网站 origin）；用划词存笔记后验笔记本归属。
3. 再在 Options **退出** → 用**第一个**账号扩展内登录。  
   **预期**：覆盖回第一账号；无死循环报错。

---

## E. 错误态（抽样）

1. 错误密码登录。  
   **预期**：红字「邮箱或密码不正确…」，状态仍为未登录。
2. 展开「高级选项」。  
   **预期**：默认折叠；展开后可见 API 地址与访问令牌；文案不要求用户打开 DevTools。

---

## F. 未登录仍可解释（回归）

1. 退出登录后划词解释。  
   **预期**：仍可流式解释；底部为「登录后可保存」，点开 Options。

---

## 结论

| 日期 | Web / 扩展版本 | 结论 | 备注 |
|------|----------------|------|------|
| | manifest `0.1.25`+ | PASS / FAIL | |
