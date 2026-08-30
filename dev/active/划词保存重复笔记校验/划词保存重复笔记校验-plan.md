# 划词保存重复笔记校验 — Plan

> **分支建议**：`fea/ext-note-duplicate-tri`  
> **池条目**：C（扩展对齐）；关联已结项「笔记重复检测」

## 目标

1. 扩展保存顶层笔记前，按 Web 相同规则检测重复 `inputText`。
2. 命中时给出「都保留 / 覆盖旧的」选择（UI 可简化，语义一致）。
3. 不改变「都保留」可多条并存的产品能力。

## 非目标

- 服务端强制唯一约束。
- 扩展内做追问树 / parentText 去重分支（当前无此 UI）。
- 改游客 localStorage 扩展路径（扩展保存本就走云端）。

---

## [PM] 验收要点（草案）

- 同一账号：Web 已存词条 A → 扩展再存 A → 出现确认，选覆盖后列表仅一条新解释；选都保留则两条。
- 不同大小写/空白：`"RAG 是啥"` vs `"rag是啥"` 视为重复（与 Web 一致）。
- 未登录：仍不能保存，行为与现网一致。

---

## [TL] 技术方案

### MVP（方案 A）

1. 扩展增加 `normalizeNoteInput(text)`（算法对齐 `ExplanationCard`）。
2. `handleSave`：`GET ${apiBaseUrl}/api/notes?q=${encodeURIComponent(text.trim())}` → filter 精确 normalize 且无 `parentText`。
3. 命中：展示简易双按钮 UI（可新组件 `DuplicateConfirm` 缩略新旧 explanation）。
4. 覆盖：`DELETE /api/notes/:id` → `POST /api/notes`；都保留：直接 POST。
5. （可选增强）抽 `lib/notes/normalize-input.ts` 供 Web 引用，扩展构建时 copy 或通过 shared——视仓库打包约束；**允许先复制后标注同步点**。

### 涉及文件（预估）

- `chrome-extension/src/content/ExplainCard.tsx`（主）
- 可选新组件同目录
- 可选抽取：`components/ExplanationCard.tsx` / `lib/...`（若做共享）
- `docs/product/notebook.md`、`docs/product/chrome-extension.md` 各补一句
- 测试：normalize 单测；扩展 E2E 若环境允许

### 风险与回滚

- 列表很大时 `q=` 不准 → 与 Web 同风险；二期可上方案 B。
- 回滚：去掉预检即可恢复直写。

---

## [QA] 影响域

- 扩展存笔记、Web 重复检测回归、DELETE/POST notes、session refresh 后保存。

## [Decision]

- MVP 扩展侧对齐 Web 客户端逻辑；服务端查重 API 作为后续收敛项记在 tasks 可选。
