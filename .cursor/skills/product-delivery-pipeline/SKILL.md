---
name: product-delivery-pipeline
description: 将需求从 PM/TL 评估推进到 PRD/PLAN 总览与 docs/product 与 docs/tech 分卷定稿、QA 与手测、自动化、BF 与结项。用户提出新功能、要按团队流程、要写验收文档或结项时使用。
---

# 产品交付管道（详版）

## 与仓库规则的关系

- **门控与五阶段**见 `.cursor/rules/dev-workflow.mdc`；本技能在其上固定 **总览+分卷** 的更新方式、**commit 点** 与 **QA/手测文档形态**（`docs/PRD.md` / `docs/PLAN.md` 为索引，模块细节进 `docs/product/*`、`docs/tech/*`）。
- **QA 分级与回归**见 `.cursor/rules/qa-process.mdc`；**commit/PR**见 `.cursor/rules/pr-and-commit.mdc`。

## 第 1 步：需求评估（无代码）

1. 以 `[PM]`、`[TL]` 输出；结尾 `[Decision]` 给出可执行结论（范围、风险、涉及模块）。
2. 交付物给用户过目：**禁止**改业务代码；可回答「是否动 PRD/PLAN/分卷」——**否**，待用户明确同意（「可以开始 / 通过 / ok」）后进入第 2 步再改。

## 第 2 步：定稿总览+分卷 + 开发准备文档 + 文档 commit

1. 在 `dev/active/需求名称/` 建立或更新（与现有一致）：
   - `需求名称-context.md`、`需求名称-plan.md`、`需求名称-tasks.md`
2. 根据本次需求**更新**：
   - `docs/PRD.md`：若只有导航/阶段变化，可只改总览与「变更一句」；产品细节写入对应 **`docs/product/*.md`**（见 `docs/product/README.md` 索引）。
   - `docs/PLAN.md`：同理；技术细节、Phase 与文件清单写入对应 **`docs/tech/*.md`**（见 `docs/tech/README.md` 索引）。
3. 从 `dev` 切功能分支（见 `.cursor/rules/git-branching.mdc`）。
4. **Commit**：单独一次或二次均可，但建议**文档先行**，例如：  
   `docs: 需求「简称」— 总览/分卷 与 dev/active 方案`  
   原则：`pr-and-commit.mdc` 的一 commit 一事。

## 第 3 步：生成 `需求名称-qa.md` + 手测流程 + 文档 commit

在 `dev/active/需求名称/需求名称-qa.md` 中至少包含以下结构（可直接复制再填空）。

### 建议目录结构

1. **## 0. 本次执行记录**（表格：时间、动作、结果：PASS/PENDING/用户确认）
2. **## 0.1 自动化测试**（命令、覆盖文件、断言语句；**不能**自动化的项写明原因）
3. **## 0.2 手测详细流程（最小路径，必做）**  
   - 逐步编号；写清**前置**（环境、Node 版本、扩展/浏览器、账号）。  
   - 每一步：**操作** → **预期** → **若失败**（看哪个 Network / 哪段 log / 哪条规则 BF）。
4. **## 0.2 续：全量 / 回归（可选）** 指向 §3/§4 用例表或写「发 major / 大改前跑」
5. **## 1. 影响域**、**## 2–4. 用例/回归**（与 `qa-process` 一致时可简化）
6. **## 5. 测试结论**（通过前保持「待用户验收」；用户签字后改 **PASS** 并标日期）

**Commit 示例**：`docs: 需求「简称」— QA 与手测流程`

## 第 4 步：自动化跑完 → 交用户手测

1. 开发者在本地/CI 跑 `npm run test` 等，把结果记入 QA §0 表。
2. 将 **qa.md 路径** 和 **最小手测 §0.2** 提醒给用户；用户**只依赖文档**完成验收。
3. 用户未说「通过」前：不结项、不把需求迁 `dev/done`（与 `dev-workflow` 阶段 5 一致）。

## 第 5 步：Bug 修复与记录

每起一个真实 bug，在 `dev/logs/需求名称-log.md` 增加一节：

```markdown
### BF-n：短标题
- **现象**：
- **根因**：
- **修复**：
- **涉及文件**：
- **验证**：（自动化或手测条目标号）
```

修完后更新 QA 与 tasks；必要时在手测文档 **§0.2** 加一条**回归**防再犯。

## 第 6 步：结项（用户通过后）

1. 更新 `需求名称-tasks.md`、`需求名称-qa.md` 结论为 **PASS** + 结项日期。
2. `git mv dev/active/需求名称 dev/done/需求名称`
3. 补全 `dev/logs/需求名称-log.md`（结项段、生产注意点、可选 Git 表）。
4. 若产品/架构有持久变化，再改 `docs/PRD.md` / `docs/PLAN.md` 与所涉 **分卷**；总览可仅更新版本与链接。
5. **收尾 commit**；向 `dev` 提 **PR** 由人执行（见团队约定）。

---

## 你怎么用（@ 技能）

- 在 Cursor 聊天中 **@ 技能** 或 **@product-delivery-pipeline**，说清当前在第几步（例如：「第 3 步，帮生成 qa 手测结构」）。
- 或说：**「按产品交付管道，从第 N 步开始」**。

## 维护

流程变更时：先改 `.cursor/rules/product-delivery-pipeline.mdc`（门控与步骤表），再改本 `SKILL.md`（模板与说明）。文档体例变更时同步 `docs/PRD.md`、`docs/PLAN.md` 与 `docs/product/`、`docs/tech/` 的 README 索引。
