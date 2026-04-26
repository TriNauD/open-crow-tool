# 周报上线就绪 — 技术方案

> 作者：TL | 创建：2026-04-26

---

## 一、背景与目标

Phase 4 周报已功能完整，但有三个问题阻碍真实用户接入：

1. **无测试隔离**：手动触发 cron 会把邮件发给所有 active 订阅者，测试时会骚扰真实用户
2. **无欢迎邮件**：用户订阅成功后什么都收不到，不知道何时会有邮件，体验差
3. **订阅接口无防滥**：`POST /api/subscribe` 无任何频率限制，任意 IP 可无限提交

---

## 二、Feature 1：`SUBSCRIBER_SEND_ENABLED` 发送开关 + 内测邮件列表

### 目标
区分"内测组发送"和"真实订阅者群发"，一个环境变量控制开关，另一个变量维护内测列表。

### 实现

改造 `app/api/cron/weekly-digest/route.ts`：

```
SUBSCRIBER_SEND_ENABLED=true   → 正常群发所有 active 订阅者
SUBSCRIBER_SEND_ENABLED 未设置 or ≠ true → 跳过订阅者群发
```

**无论开关状态，始终发给内测列表：**

```bash
# 逗号分隔，支持多个邮箱（替代原来单一的 DIGEST_TO_EMAIL）
DIGEST_TEST_EMAILS=you@gmail.com,friend@gmail.com
```

内测邮件和订阅者一样，也带退订链接（但 token 从 DB 动态查，如果 DB 里没有就不带）。

log 字段新增：
```json
{
  "subscriberSendEnabled": false,
  "subscriberSendSkipped": true,
  "testEmailsSent": 2
}
```

### 环境变量变更

```bash
# 废弃：DIGEST_TO_EMAIL（改名，向后兼容：如果 DIGEST_TEST_EMAILS 未设置则 fallback 到 DIGEST_TO_EMAIL）
# 新增：
DIGEST_TEST_EMAILS=tzeduan@gmail.com,friend@example.com
SUBSCRIBER_SEND_ENABLED=true   # 生产环境才设为 true
```

---

## 三、Feature 2：订阅成功欢迎邮件

### 目标
用户提交邮箱成功后立即收到确认邮件，内容：
- 订阅成功确认
- 发送频率说明（每周一 17:00 北京时间）
- 内容简介（五档评审榜）
- 退订链接

### 实现

**Step 1 - `lib/email.ts` 新增函数：**

```typescript
export async function sendWelcomeEmail(
  to: string,
  unsubscribeUrl: string
): Promise<void>
```

邮件主题：`已订阅 | GitHub 周报「速通热榜」确认`

HTML 复用现有样式（dark header + white body + footer 退订链接），无需新模板框架。

**Step 2 - `app/api/subscribe/route.ts` 改造：**

```typescript
const { subscriber, alreadyExists } = await createSubscriber(email);

if (!alreadyExists) {
  const baseUrl = new URL(req.url).origin;
  const unsubscribeUrl = `${baseUrl}/api/unsubscribe?token=${subscriber.unsubscribe_token}`;
  // fire-and-forget：发送失败不影响订阅成功响应
  sendWelcomeEmail(email, unsubscribeUrl).catch((err) =>
    console.error('[subscribe] welcome email failed:', err)
  );
}
```

**关键设计：fire-and-forget**
欢迎邮件发送失败不能让订阅接口返回 500，订阅本身已成功写 DB，邮件是附赠的。

---

## 四、Feature 3：订阅接口基础防滥

### 目标
防止单 IP 频繁调用 `/api/subscribe` 刷订阅者列表。

### 方案选择

| 方案 | 优点 | 缺点 |
|---|---|---|
| Vercel Edge Rate Limit | 零代码 | 需要 Pro 计划 |
| **In-memory Map（选）** | 零依赖，够用 | 多实例失效（Vercel 可能多 worker） |
| Redis/Upstash | 精准，生产可用 | 多一个依赖和费用 |

当前阶段用户量极小，**in-memory 方案已够用**：同一 IP 60 秒内最多 3 次订阅请求，超过返回 429。

```typescript
// app/api/subscribe/route.ts 顶部
const rateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 3;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true; // allowed
  }
  if (entry.count >= RATE_LIMIT) return false; // blocked
  entry.count++;
  return true;
}
```

IP 从 `req.headers.get('x-forwarded-for')` 取，Vercel 会注入。

---

## 五、Feature 4：退订确认邮件

### 目标
用户点击退订链接后，发送一封极简确认邮件：
- 确认已退订
- 一个"如果误操作，点此重新订阅"的链接
- **绝对不放任何产品推广内容**，防止用户觉得"退了还发"

### 实现

`lib/email.ts` 新增 `sendUnsubscribeConfirmEmail(to: string, resubscribeUrl: string)`

`app/api/unsubscribe/route.ts` 在 `cancelByToken` 成功后 fire-and-forget 触发。

邮件主题：`已退订 | 你不会再收到 GitHub 周报`

内容：
```
你已成功退订 GitHub 周报「速通热榜」。

如果是误操作，点此重新订阅：[重新订阅] → /subscribe
```

---

## 六、改动文件清单

```
改造：
  app/api/cron/weekly-digest/route.ts  — SUBSCRIBER_SEND_ENABLED 开关 + DIGEST_TEST_EMAILS 列表
  app/api/subscribe/route.ts           — rate limit + 发欢迎邮件
  app/api/unsubscribe/route.ts         — cancelByToken 成功后发退订确认邮件
  lib/email.ts                         — 新增 sendWelcomeEmail() + sendUnsubscribeConfirmEmail()
  .env.local.example                   — 新增/更新变量注释

新增：
  （无）

环境变量：
  DIGEST_TEST_EMAILS    — 新增（逗号分隔，替代 DIGEST_TO_EMAIL）
  SUBSCRIBER_SEND_ENABLED — 新增
  DIGEST_TO_EMAIL       — 保留作 fallback（向后兼容）
```

---

## 六、验收标准

见 `周报上线就绪-tasks.md`
