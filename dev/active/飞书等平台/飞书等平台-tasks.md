# 飞书等平台 — Tasks

> 调研可不切功能分支；**实现前**：`git checkout dev && git pull` → `git checkout -b fea/feishu-integration-tri`  
> **编码门禁**：商业/选型 Go + 用户明确批准后再写生产业务代码。

## 阶段 R：调研（文档产出）

- [ ] 验证：Chrome 扩展在飞书**网页版**文档是否可用（记录 OS/浏览器/限制）
- [ ] 阅读飞书开放平台：机器人 vs 文档小组件 vs 网页应用，填比较表
- [ ] PM+TL：写出 Go/No-Go 与推荐路径，贴回本目录或 `飞书等平台-plan.md` 补丁段
- [ ] 若 No-Go：更新需求池状态为「搁置」并停止实现段

## 阶段 1：实现（仅 Go 后）

- [ ] 定稿载体（A 增强说明 / B 机器人 / C 插件）
- [ ] Env 示例与 Vercel 配置说明（无真实密钥）
- [ ] 适配器 API + 验签
- [ ] 调用 explain；定义是否支持存笔记
- [ ] 基础错误处理与限流

## 阶段 2：验证与文档

- [ ] 手测：正常解释 / 非法签名 / 超时
- [ ] `npm run lint` / `npm run test`
- [ ] 更新 product/tech 分卷；写 `飞书等平台-qa.md`
