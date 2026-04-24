# Chrome 插件 — 任务清单

## 进度

- [x] 建立 dev 需求文档
- [x] Web 端加 CORS（lib/cors.ts + 3 个 API 路由）
- [x] 创建 chrome-extension/ 目录
- [x] 写 package.json / tsconfig.json / vite.config.ts / manifest.json
- [x] 写 src/content/styles.ts（CSS 字符串）
- [x] 写 src/content/useStreamExplain.ts
- [x] 写 src/content/FloatingButton.tsx
- [x] 写 src/content/ExplainCard.tsx
- [x] 写 src/content/App.tsx
- [x] 写 src/content/index.tsx（Shadow DOM 挂载）
- [x] 写 src/background/index.ts（Alt+W 快捷键）
- [x] 写 Options 页（index.html + main.tsx + Options.tsx）
- [x] 写 Popup 页（index.html + main.tsx）
- [x] npm install（升级到 @crxjs/vite-plugin@2.0.0 稳定版）
- [x] npm run build 成功，dist/ 目录生成
- [x] 加载到 Chrome，无报错
- [x] PM 审核
- [x] 用户验收 ✅ 2026-04-24

## 验收标准
1. 在 X.com 选中文字 → 浮动橙色按钮出现在文字旁边
2. 点击按钮 → 气泡卡片出现，AI 解释流式输出
3. 按 Alt+W → 同样触发解释
4. 点击"存入笔记本" → Web 端笔记本里能看到，来源标注"插件"
5. 点击卡片外部 → 卡片消失
6. 按 Esc → 卡片消失
7. Options 填错 secret → 存入笔记本失败并提示
