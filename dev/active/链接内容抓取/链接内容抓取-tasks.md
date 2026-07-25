# 链接内容抓取 — Tasks

> 开工前：`git checkout dev && git pull` → `git checkout -b fea/url-content-fetch-tri`  
> **编码门禁**：用户明确批准后再改业务代码；SSRF 单测未绿不得合入。

## 阶段 0：定稿

- [ ] PM：确认触发方式（推荐点选）、登录是否必填、失败文案
- [ ] TL：确认超时/字节上限、是否引入 Readability 依赖
- [ ] TL：列出 SSRF 测试矩阵（localhost、RFC1918、metadata IP、redirect 绕过）

## 阶段 1：安全抓取库 + API

- [ ] 实现 `fetch-safe`（解析、DNS、redirect、超时、截断）
- [ ] `POST /api/fetch-url` + 错误码
- [ ] Vitest：SSRF / 超时 mock / 正常 HTML 抽取
- [ ] 限流（与现有策略对齐或简单 IP/user 计数）

## 阶段 2：Web 衔接

- [ ] 首页：识别 URL +「读取链接」
- [ ] 将正文摘要送入 explain（prompt 槽位或拼接）
- [ ] 加载/失败/降级 UI

## 阶段 3：验证与文档

- [ ] 手测公开页 + 恶意 URL 拒绝
- [ ] `npm run lint` / `npm run test`
- [ ] 更新 tech/product 分卷安全说明；写 `链接内容抓取-qa.md`
