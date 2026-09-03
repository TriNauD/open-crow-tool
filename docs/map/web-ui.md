# Web 页面与共享 UI（`app/` 页面 + `components/` + `hooks/`）

## 页面（App Router）

| 文件 | 职责 |
|---|---|
| `app/layout.tsx` | 根布局：Geist 字体、metadata（「这是啥？」） |
| `app/page.tsx` | **首页**：输入 / 划词解释器；Enter 发送、Alt+Enter 换行（提示文案见 `lib/keyboard-send-hint.ts`） |
| `app/notebook/page.tsx` | 云笔记本：笔记列表 / 分类聚合 / 删除；游客笔记展示与迁移入口 |
| `app/settings/page.tsx` | 用户自配 LLM（OpenAI-compatible）设置 + 「测试连接」（读 `x-crow-provider` 判断回退） |
| `app/login/page.tsx` | 邮箱密码登录 |
| `app/register/page.tsx` | 邮箱密码注册 |
| `app/subscribe/page.tsx` | 订阅周报页（客户端状态机） |
| `app/unsubscribe/page.tsx` | 退订结果页（服务端组件，读 `searchParams.status`） |

## 组件（`components/`）

| 文件 | 职责 |
|---|---|
| `components/ExplanationCard.tsx` | 解释卡展示（流式渲染、保存）；扩展侧平行实现见 [README 平行实现表](./README.md) |
| `components/AuthNav.tsx` | 导航栏：登录态、扩展连接状态；**「连接扩展」postMessage 广播入口（网页侧唯一直发点）** |
| `components/DuplicateNoteModal.tsx` | 重复保存确认弹窗（查重规范化用 `lib/notes/normalize-input.ts`） |
| `components/GuestMigrationModal.tsx` | 游客笔记 → 账号迁移弹窗（调 `app/api/notes/migrate-guest/route.ts`） |

## Hooks（`hooks/`）

| 文件 | 职责 |
|---|---|
| `hooks/useStreamExplain.ts` | 流式 explain 客户端状态机（分块读取、用户 LLM 配置头 `x-crow-llm-config`）；扩展有平行版 |
| `hooks/useAuthSession.ts` | Supabase 浏览器会话（登录态 / 登出）；本地态与 GoTrue 不一致时自动清理防红屏 |

## 接缝

- 页面 → API：笔记走 `lib/api/notes-client.ts`（Bearer 头），解释走 `hooks/useStreamExplain.ts`。
- 浏览器 Supabase 单例：`lib/supabase/browser.ts`；注册确认邮件回跳地址：`lib/auth/email-confirm-redirect.ts`（须在 Supabase Dashboard Redirect URLs 白名单）。
- 截图上传（C-2）：客户端压缩 `lib/client/compress-image.ts`，服务端限制 `lib/ai/image-limits.ts`。
- 多用户开关（紧急回滚）：`lib/config/notebook.ts` 读 `NOTEBOOK_MULTI_USER_ENABLED`。

## 相关测试 / E2E

- E2E：`e2e/a1-home-send-shortcut-hint.spec.ts`、`e2e/register-password-confirm.spec.ts`
- 单测：`__tests__/keyboard-send-hint.test.ts`、`__tests__/normalize-note-input.test.ts`、`__tests__/note-tags.test.ts`
