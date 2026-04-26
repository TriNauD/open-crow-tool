# 周报上线就绪 — 上下文与关键决策

> 作者：TL | 创建：2026-04-26

---

## 背景

Phase 4 外部订阅功能已上线并通过用户验收（2026-04-26）。
已有一位真实用户提供了邮箱，但暂不敢直接加入订阅列表，原因是：
- 测试 cron 时邮件会发给所有 active 订阅者，没有隔离机制
- 用户订阅成功后无任何反馈邮件，体验差

---

## 关键决策

### 决策 1：用环境变量做发送开关，而非 DB 字段

**备选方案**：
- DB 里加 `is_test` 字段区分测试/真实用户
- 用 subscriber tags 字段

**选择理由**：
- 环境变量方案零 DB 改动，Vercel 上随时可以拨动
- 测试隔离是运维层面的需求，不是数据层面的需求
- 真实用户邮箱现在就可以加入 DB，等开关打开自然开始收到邮件

### 决策 2：欢迎邮件 fire-and-forget，不阻塞订阅响应

**理由**：
- 订阅的核心是写 DB，邮件是附赠品
- 如果邮件 SMTP 暂时抖动，不应该让用户的订阅操作返回失败
- 失败日志写 console.error，Vercel 日志里能看到

### 决策 3：in-memory rate limit，暂不引入 Redis

**理由**：
- 当前阶段用户量极小（个位数订阅），不需要跨 worker 精确限速
- 零额外依赖和费用
- 等用户量上来 / Phase 5 需要时再换 Upstash Redis

---

## 当前技术状态

- `createSubscriber()` 已返回完整 `subscriber` 对象（含 `unsubscribe_token`），无需改 DB 层
- `lib/email.ts` 中 SMTP 发送逻辑已封装，`sendWelcomeEmail` 直接复用
- cron route 中群发段已有清晰边界（Step 3），加开关只需包一层 `if`
