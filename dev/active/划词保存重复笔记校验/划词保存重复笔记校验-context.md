# 划词保存重复笔记校验 — Context

> **来源**：BRAINSTORM 需求池（[`待办-C-划词保存重复笔记校验.md`](../BRAINSTORM需求池/待办-C-划词保存重复笔记校验.md)，总表原未编号）  
> **立项性质**：**前瞻立项文档**（文档先行）。待阶段 2 / 排期确认后再编码。  
> **参考结项**：[`dev/done/笔记重复检测/`](../../done/笔记重复检测/)（Web 已交付）。

## 背景 / 痛点

- Web 保存顶层笔记时已有重复检测（标准化 `inputText` + 对比弹窗：都保留 / 覆盖）。
- Chrome 扩展 `ExplainCard.handleSave` **直接** `POST /api/notes`，无预检 → 同一划词可刷出多条重复云笔记。
- 产品分卷 `docs/product/notebook.md` 已描述 Web 规则；扩展应对齐，避免「网站严谨、插件随便」。

## 现状（调研）

| 项 | 结论 |
|----|------|
| Web | `components/ExplanationCard.tsx`：normalize = trim + toLowerCase + 去空白；仅 `depth===0 && !context`；云端用 `fetchNotes(token, inputText)` 再精确匹配且 `!parentText`；`DuplicateNoteModal` |
| API | `POST /api/notes` **无**服务端去重，始终 insert |
| 扩展 | `chrome-extension/src/content/ExplainCard.tsx`：无预检、无弹窗 |
| 其他 | Guest 迁移按 `client_note_id` 幂等，与内容去重无关 |

## 约束

- 规则须与 Web **同一套标准化与「仅顶层」语义**（扩展暂无追问树，等同顶层）。
- 扩展 UI 空间小：对比弹窗需适配卡片宽度（简化版可接受）。
- 鉴权：查重需 Bearer；未连接时仍维持「连接后可保存」现文案。

## 关键决策（待用户确认）

| 选项 | 说明 | 推荐默认 |
|------|------|----------|
| **A. 扩展内复刻客户端逻辑** | 保存前 `GET /api/notes?q=` + 同 normalize 匹配 + 迷你确认 UI | **推荐 MVP**（最快对齐） |
| **B. 服务端查重 API** | 如 `POST /api/notes/check-duplicate` 或 POST 支持 `?check=1` | 更稳，Web/扩展可逐步收敛 |
| **C. 服务端强制唯一** | DB unique(user_id, normalized_input) | **不推荐**：破坏「都保留」产品选项 |

**覆盖旧笔记**：扩展需调用现有 `DELETE /api/notes/:id` 再 POST（与 Web 一致）。

## 依赖与风险

- **依赖**：扩展已能 `ensureFreshAuth` + notes API；可抽 shared normalize 到两边能复用的包，或扩展内复制常量并单测锁行为。
- **风险**：`q=` 搜索是 ilike，未必只返回精确项——须与 Web 一样在客户端再精确匹配。
- **共享代码**：monorepo 若暂无 shared 包，允许扩展侧复制 normalize 函数并加注释「须与 Web 同步」。

## 文档索引

- [`划词保存重复笔记校验-plan.md`](./划词保存重复笔记校验-plan.md)
- [`划词保存重复笔记校验-tasks.md`](./划词保存重复笔记校验-tasks.md)
