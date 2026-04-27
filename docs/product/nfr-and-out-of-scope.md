# 非功能需求与明确不做

> 原 PRD「五、非功能性需求」「六、不在范围内」

## 非功能性需求

**成本控制：**
- Supabase 免费层：512MB DB，够用很久
- Vercel 免费层：足够自用流量 + Cron 每日1次
- Resend 免费层：3000 封/月，自用绰绰有余
- AI API：按实际 token 消耗，不产生闲置成本

**可扩展性（开发时注意预留）：**
- DB schema 保留 `user_id`，支持多用户
- API routes 的鉴权逻辑抽象为中间件，方便替换认证方案
- Chrome 插件与 Web 端共享 API 接口，不做专用接口

**历史数据：**
- localStorage 中的已有笔记不做迁移（已确认）
- Phase 1 上线后，笔记以云端为主

## 明确 out of scope

- 移动端 App
- 社交功能（分享笔记等）
- 自定义 AI 模型（用户自己配置 key）
- 图片/截图 OCR 输入
- Chrome 插件**内嵌**独立 Supabase 登录（与「网站先登录再连接」二选一；当前采用后者，无独立内嵌计划则保持 out of scope 直至产品明确）
