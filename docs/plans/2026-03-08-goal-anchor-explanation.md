# Goal Anchor Explanation Implementation Plan

> **For Codex/Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Add a lightweight explanation card so users can understand why the system derived the current `goalAnchor` and quickly decide whether to edit it.

**Architecture:** Store a small `GoalAnchorExplanation` alongside each job. Generate it together with the initial `goalAnchor` during task creation, with the same success/fallback behavior. The explanation is display-only and does not affect optimizer or reviewer control logic.

**Tech Stack:** Next.js App Router, TypeScript, Node SQLite, CPAMC adapter, node:test

---

### Task 1: Add Explanation Model And Tests

**Files:**
- Create: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/lib/server/goal-anchor-explanation.ts`
- Create: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/tests/goal-anchor-explanation.test.ts`
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/lib/server/types.ts`

**Step 1: Write the failing test**

Add tests for:
- deriving a local fallback explanation
- normalizing parsed explanation payloads
- serializing and parsing explanation JSON

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/goal-anchor-explanation.test.ts`
Expected: FAIL because the helper does not exist yet.

**Step 3: Write minimal implementation**

Add the explanation type and helper module.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/goal-anchor-explanation.test.ts`
Expected: PASS

### Task 2: Generate And Persist Explanation During Job Creation

**Files:**
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/lib/server/db.ts`
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/lib/server/jobs.ts`
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/lib/server/model-adapter.ts`
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/lib/server/prompting.ts`
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/tests/task-controls.test.ts`
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/tests/prompting.test.ts`

**Step 1: Write the failing test**

Add assertions for:
- successful explanation generation with the model
- fallback explanation when generation fails
- job payload includes normalized explanation

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/task-controls.test.ts tests/prompting.test.ts`
Expected: FAIL because explanation is not generated or stored yet.

**Step 3: Write minimal implementation**

Persist explanation JSON on jobs and thread it through creation/fallback logic.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/task-controls.test.ts tests/prompting.test.ts`
Expected: PASS

### Task 3: Render Explanation Card In Job Detail

**Files:**
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/components/job-detail-shell.tsx`
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/styles/globals.css`

**Step 1: Keep tests green**

Run: `npm test -- tests/goal-anchor-explanation.test.ts tests/task-controls.test.ts`
Expected: PASS

**Step 2: Write minimal implementation**

Add a display-only explanation card under the `goalAnchor` editor.

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

### Task 4: Full Verification

**Files:**
- Modify: none unless verification fails

**Step 1: Run full verification**

Run: `npm run check`
Expected: `typecheck`, `test`, and `build` all pass.
