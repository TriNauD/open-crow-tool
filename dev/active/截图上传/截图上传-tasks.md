# 截图上传 — Tasks

> 开工前：`git checkout dev && git pull` → `git checkout -b fea/screenshot-multimodal-tri`  
> **编码门禁**：用户明确批准后再改业务代码。

## 阶段 0：定稿

- [ ] PM：确认输入方式、是否存原图到笔记、配额数字
- [ ] TL：确认生产/Preview 所用模型均支持 vision；记录 fallback 文案
- [ ] TL：确认 Vercel/request body 上限与压缩目标分辨率

## 阶段 1：服务端

- [ ] 图像校验工具（mime、大小、可选尺寸）
- [ ] `/api/explain` 接受 `image`；组装多模态 messages
- [ ] Provider 层确认兼容；失败可理解错误码/文案
- [ ] 单测：无图旧路径；非法 mime 拒绝

## 阶段 2：Web UI

- [ ] 粘贴 / 文件选择 + 预览 / 清除
- [ ] `useStreamExplain` 传 image
- [ ] 加载与错误态
- [ ] （按定稿）保存笔记时的文本占位策略

## 阶段 3：验证与文档

- [ ] 手测：小图/大图/非图片文件/纯文本回归
- [ ] `npm run lint` / `npm run test`
- [ ] 更新分卷与 `.env.local.example` 注释；写 `截图上传-qa.md`
