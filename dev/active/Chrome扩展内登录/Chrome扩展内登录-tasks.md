# Chrome 扩展内登录 — Tasks

> 开工前：`git checkout dev && git pull` → `git checkout -b fea/chrome-ext-standalone-login-<owner>`  
> 结项前：QA 文档 `Chrome扩展内登录-qa.md`、迁移 `dev/done/`、补 `dev/logs/`（见 `dev-workflow.mdc`）

## 阶段 0：定稿

- [ ] TL：**选定扩展内登录主方案**（Plan 中 A / B 或组合），并记录于本文件或 plan「补丁」段
- [ ] TL：确认 **apiBaseUrl / Supabase 环境** 在 Preview / 生产与扩展构建参数一致
- [ ] PM：定稿 **主界面文案**（登录、失败、退出）与 **高级区** 标题

## 阶段 1：实现

- [ ] Options：**主路径** — 登录表单或「打开登录」流，成功后 `persistCrowAuth`（字段与网站桥接一致）
- [ ] Options：**退出登录** — 清理 `CROW_AUTH_LOCAL_KEYS` 及遗留 sync 字段（与现 `persistCrowAuth`/手动保存逻辑对齐）
- [ ] Options：**布局** — 「手动填写」默认折叠，文案去技术化；保留自托管能力
- [ ] 扩展：**错误与加载态** — 网络失败、凭据错误、429 等可理解提示
- [ ] （若方案 B）Web：**OAuth / 回调路由** + 扩展 `identity` 或文档登记
- [ ] `manifest.json`：**权限**（如 `identity`）与版本号按发布规范更新
- [ ] 文档：更新 `docs/product/chrome-extension.md`（或等价）中的安装与登录说明

## 阶段 2：验证

- [ ] 手测：仅扩展登录 → 划词 → 存笔记 → 刷新会话后仍可用
- [ ] 手测：仅网站连接 → 仍可用（回归）
- [ ] 手测：两种入口 **先后使用**，确认「后写覆盖」与 UI 状态正确
- [ ] `npm run lint`（及团队约定 `verify`）通过

## 阶段 3：QA / 收尾

- [ ] 新建并填写 `Chrome扩展内登录-qa.md`
- [ ] PM 审核 tasks 全勾 + 用户验收后再 commit / PR（见 `dev-workflow.mdc` 阶段 5）
