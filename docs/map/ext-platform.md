# 扩展 · 平台层（background / lib / options / popup / 共享组件）

## Service worker（`chrome-extension/src/background/`）

| 文件 | 职责 |
|---|---|
| `chrome-extension/src/background/index.ts` | MV3 SW：onInstalled 向旧标签页补注入 content script（从构建后 manifest 动态取路径，crxjs 产物含 hash）；auth 广播兜底（sendMessage 失败用 executeScript 投递同一事件）；refresh / 登录请求中转（`CROW_EXCHANGE_REFRESH` 等） |

## 会话与登录（`chrome-extension/src/lib/`）

| 文件 | 职责 |
|---|---|
| `chrome-extension/src/lib/crow-session.ts` | **会话中枢**：chrome.storage.local 读写（`CROW_AUTH_LOCAL_KEYS`）、`ensureFreshAuth`（JWT exp + 120s skew、refresh 串行锁、SW 优先直连兜底）、explain 全局开关（`CROW_EXTENSION_ENABLED_KEY`）、打包常量（env `VITE_PUBLIC_SITE_ORIGIN` / `VITE_PUBLIC_SUPABASE_URL` / `VITE_PUBLIC_SUPABASE_ANON_KEY`） |
| `chrome-extension/src/lib/crow-session-types.ts` | `CrowAuth` 类型 |
| `chrome-extension/src/lib/crow-auth-event.ts` | 广播事件名常量 `crow-ext-auth-updated`（content / background 共用） |
| `chrome-extension/src/lib/crow-auth-build.ts` | 内嵌登录**纯逻辑**（无 chrome 依赖，根目录 Vitest 可直接测） |
| `chrome-extension/src/lib/crow-inline-login.ts` | 内嵌登录 chrome 传输与持久化（双通道：SW 优先，直连兜底） |
| `chrome-extension/src/lib/supabase-password-login.ts` | GoTrue password grant 直连登录 |
| `chrome-extension/src/lib/supabase-refresh-exchange.ts` | refresh token 交换 |
| `chrome-extension/src/lib/user-llm-config.ts` | 扩展版用户自配 LLM（chrome.storage；Web 版 `lib/user-llm-config.ts` 平行实现，头常量必须一致） |
| `chrome-extension/src/lib/extension-context.ts` | "Extension context invalidated" 检测与吞错工具 |

## UI 入口与共享组件

| 文件 | 职责 |
|---|---|
| `chrome-extension/src/components/CrowLoginForm.tsx` | 内嵌登录表单（划词卡片 / Popup 共用；GoTrue password grant → `persistCrowAuth`） |
| `chrome-extension/src/options/Options.tsx` | 设置页主组件：连接网站 / 扩展内直登、explain 开关、会话状态 |
| `chrome-extension/src/options/main.tsx` | Options 挂载入口（页面骨架 `chrome-extension/src/options/index.html`） |
| `chrome-extension/src/popup/main.tsx` | Popup：开关 + 登录态 / 登录表单（页面骨架 `chrome-extension/src/popup/index.html`） |

## 构建配置

- `chrome-extension/vite.config.ts`（@crxjs）+ `chrome-extension/manifest.json`（MV3 权限 / 入口）；独立 npm 包，构建 `npm run build --prefix chrome-extension`；env 样例见 `chrome-extension/.env.example`。

## 坑

- **纯逻辑文件不得 import chrome 全局**（如 `chrome-extension/src/lib/crow-auth-build.ts`）：网站的 tsconfig 会把被引用的扩展文件拖进类型检查。新增可测纯逻辑时仿照此拆分，测试放根目录 `__tests__/`。
- 旧版会话只存 chrome.storage.sync（仅 access token）——`loadCrowAuth` 有 legacy 兼容分支，`persistCrowAuth` / `clearCrowAuth` 会同步清 sync 键；改存储结构两处都要顾。
- manifest 里 content script 路径含 hash，background 补注入必须动态读 manifest，不能硬编码。
- 旧「连接插件」会话缺 supabaseUrl / anon：`applyBuildSupabaseDefaults`（`chrome-extension/src/lib/crow-session.ts`）用打包常量补齐，否则无法 refresh。

## 相关测试 / E2E

- 单测：`__tests__/crow-inline-login.test.ts`、`__tests__/supabase-password-login.test.ts`
- E2E：`e2e/extension-crow-bridge.spec.ts` + `e2e/extension-fixtures.ts`（先构建扩展）
