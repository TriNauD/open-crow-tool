# Chrome 扩展插件内 Refresh — Preview 最小手测

**Preview URL**（合并入 `dev` 后填）：`（待填：Vercel 本次 Preview 链接）`

**前置（一句）**：扩展已 `npm run build` 并加载 **`chrome-extension/dist`**；Preview 若开 Vercel **Deployment Protection**，扩展请求可能 401，见 `docs/tech/environments-and-deployment.md`。

1. Preview **登录** → 点「**连接插件**」。
2. 任意 **https** 页 **划词 → 解释**（或存笔记）→ **成功**。
3. **续期**：保持网站登录、**不再点连接**，待 **access JWT 过期**（常约 1h；或仅 Staging 临时缩短 JWT）后，同场景再试 → **仍成功**。未测则本条写 **SKIP** 并备注。
4. 网站 **退出登录**，不重新连接，再划词请求 → **失败**，且文案引导 **回站登录并「连接插件」**。

**结论**：☐ PASS ☐ FAIL　**备注**：
