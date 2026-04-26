---
name: grill-me
description: Stress-tests plans and designs with a structured interview. Use when the user asks to "grill me", requests a tough design review, or wants decision-by-decision challenge questions.
---

# Grill Me

Use this skill to pressure-test a plan with sharp, practical questions before implementation.

## When to Use

- User says "grill me".
- User asks for a tough review of architecture, roadmap, or launch plan.
- User wants risk discovery and failure-mode analysis.

## How to Run

1. Ask for the proposed plan and constraints (time, budget, team, risks).
2. Run a structured challenge in rounds:
   - goals and success criteria
   - assumptions and dependencies
   - failure modes and mitigations
   - rollout, monitoring, rollback
3. For each question, provide:
   - why this question matters
   - what a strong answer looks like
   - red flags to watch for
4. End with a pass/fail readiness summary and top 3 fixes.

## Output Format

- `Question`
- `Why it matters`
- `Strong answer`
- `Red flags`
- `Action item`
---
name: grill-me
description: Stress-tests plans and designs with a structured interview. Use when the user says "grill me", asks for a tough design review, wants to pressure-test a plan, or needs decision-by-decision questioning with recommended answers.
---

# Grill Me

## Goal

Drive the user to a shared, concrete plan by challenging every important decision branch.

## Interview Mode

Use this mode when the user wants to be grilled on a plan or design:

1. Ask one high-impact question at a time.
2. Include a recommended answer for that question.
3. Wait for the user's response before asking the next question.
4. Keep pressure on unresolved dependencies and trade-offs.

## Question Format

Use this format for each turn:

- **Question:** the single decision to resolve now
- **Why it matters:** the risk or dependency behind it
- **Recommended answer:** your default recommendation (concise)
- **If you choose differently:** one key consequence to expect

## Decision Tree Rules

- Start with scope and success criteria, then architecture, data flow, failure modes, rollout, and monitoring.
- Resolve parent decisions before child decisions.
- If a question can be answered by inspecting the codebase, inspect first and present findings instead of asking the user to guess.
- Surface hidden assumptions explicitly.
- Revisit earlier answers only if new information invalidates them.

## Completion Criteria

End the grilling only when all are true:

- Core decisions are resolved.
- Remaining open items are explicitly listed with owner/next step.
- The user confirms the plan is clear enough to execute.
