# 用户自配 API（OpenAI-compatible）— 保姆级手动测试

> 前置：功能分支 `fea/user-llm-config-wesrindo`；扩展 manifest **0.1.27+**（`cd chrome-extension && npm ci && npm run build` 后在 `chrome://extensions` 重新加载 `dist`）。
> 环境二选一：本地 `npm run dev`（http://localhost:3000），或 future 部署 URL。
> 准备一组任一 OpenAI 兼容服务的真实凭证（DeepSeek / Kimi / SiliconFlow / OpenAI 均可），例如：
> - Base URL：`https://api.deepseek.com/v1`
> - API Key：`sk-xxxx`
> - 模型名：`deepseek-chat`

---

## A. Web 端设置页

1. 打开网站首页 → 顶部导航点「**设置**」。
   **预期**：进入 `/settings`，显示「未启用，使用默认通道」状态条，三个空字段。
2. 填入 Base URL / API Key / 模型名 → 点「**保存**」。
   **预期**：按钮变「✓ 已保存」，状态条变绿色「已启用自定义 API」。
3. 只填部分字段（如清空模型名）再保存。
   **预期**：出现红色提示「请填写完整的 API 地址…」，不写入。
4. 点「**测试连接**」（配置正确时）。
   **预期**：绿色「✓ 测试成功，正在使用你配置的 API（模型名）」。
   **失败看哪里**：Network 中 `POST /api/explain` 请求头应有 `X-Crow-LLM-Config`；响应头 `X-Crow-Provider` 应为 `custom`；服务端日志 `[explain] using provider="custom"`。
5. 把 API Key 改成乱串 → 保存 → 再点「测试连接」。
   **预期**：黄色「请求成功，但回退到了默认通道（siliconflow 或 nvidia）…」——回退兜底生效，页面功能不受影响。
6. 点「**清除配置**」→ 回首页划一段文字解释。
   **预期**：清除后状态条回到灰色「未启用」；解释正常（走默认通道）。

## B. Web 端真实链路透传

1. 填好并保存一组与默认通道**不同的**服务（如默认是 SiliconFlow，自配 DeepSeek）。
2. 首页输入一个词解释。
   **预期**：正常出解释；服务端日志显示 `provider="custom", model="你的模型名"`。
3. DevTools → Application → Local Storage → `crow.userLlmConfig`。
   **预期**：能见到三项配置 JSON；确认没有任何配置被发送到服务端存储（无相关 DB/接口写入）。

## C. Chrome 扩展端

1. 打开扩展 Options 页 → 点「**▼ 自定义 AI 接口（可选）**」。
   **预期**：展开三个字段 + 状态条「未启用，走默认通道」。
2. 填三项 → 「**保存**」。
   **预期**：按钮变「✓ 已保存」，状态条变「已启用自定义 API」。
3. 任意网页划词 → 点浮标等解释完成。
   **预期**：解释正常；`chrome://extensions` → 扩展 SW 日志或站点服务端日志确认 `provider="custom"`。
4. 把 Key 改错 → 保存 → 再划词。
   **预期**：解释仍正常（自动回退默认通道），不报错给用户。
5. 点「**清除配置**」→ 再划词。
   **预期**：回到默认通道；`chrome.storage.local` 中 `crowUserLlmConfig` 已移除。
   **失败看哪里**：划词请求的 Request Headers 是否带 `X-Crow-LLM-Config`；预检（OPTIONS）响应 `Access-Control-Allow-Headers` 是否包含 `x-crow-llm-config`。

## D. 服务端安全校验（可选，用 curl）

```bash
# http 明文地址应被静默忽略（走默认通道，响应头 x-crow-provider 不是 custom）
curl -si http://localhost:3000/api/explain \
  -H 'Content-Type: application/json' \
  -H "X-Crow-LLM-Config: $(printf '{"baseURL":"http://api.example.com/v1","apiKey":"k","model":"m"}' | base64)" \
  -d '{"text":"hi"}' | grep -i x-crow-provider
```

**预期**：`x-crow-provider` 为 env 主通道（如 `siliconflow`），而非 `custom`。私网地址（`https://192.168.1.1/v1`）同理。
**注意**：`http://localhost` 仅在非生产环境放行（本地联调 Ollama 用）。

---

## 回归确认（改过即测）

- [ ] 未配置用户 API 时，首页/扩展划词解释与之前行为完全一致（env 链不变）。
- [ ] 扩展登录/连接插件不受影响（本需求未动认证代码）。
- [ ] 周报 cron（`/api/cron/weekly-digest`）仍走 env 通道（未改）。
- [ ] `npm run lint` / `npm run test` 全绿；`cd chrome-extension && npm run build` 成功。
