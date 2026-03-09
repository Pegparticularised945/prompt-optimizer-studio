# Reviewer Drift Labels Implementation Plan

> **For Codex/Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Make reviewer drift failures easier to understand by adding fixed drift labels plus a short drift explanation alongside existing review feedback.

**Architecture:** Extend `RoundJudgment` and judge-run persistence with `driftLabels` and `driftExplanation`. Update reviewer prompts to require labels when goal fidelity fails, then render those fields in job detail without changing the broader worker architecture.

**Tech Stack:** Next.js App Router, TypeScript, Node SQLite, CPAMC adapter, node:test

---

### Task 1: Extend Review Model And Tests

**Files:**
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/lib/engine/optimization-cycle.ts`
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/tests/reviewer-flow.test.ts`

**Step 1: Write the failing test**

Add tests covering:
- drift labels are accepted on review results
- no regression in pass streak logic when labels are empty

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/reviewer-flow.test.ts`
Expected: FAIL because the fields do not exist yet.

**Step 3: Write minimal implementation**

Add `driftLabels` and `driftExplanation` to the review model.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/reviewer-flow.test.ts`
Expected: PASS

### Task 2: Update Reviewer Prompt And Adapter Parsing

**Files:**
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/lib/server/prompting.ts`
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/lib/server/model-adapter.ts`
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/tests/prompting.test.ts`

**Step 1: Write the failing test**

Add assertions that reviewer prompt:
- includes the fixed label vocabulary
- requires labels when fidelity fails

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/prompting.test.ts`
Expected: FAIL because the reviewer prompt does not mention drift labels yet.

**Step 3: Write minimal implementation**

Update prompt wording and parse the new fields from reviewer JSON.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/prompting.test.ts`
Expected: PASS

### Task 3: Persist And Render Drift Labels

**Files:**
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/lib/server/db.ts`
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/lib/server/jobs.ts`
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/components/job-detail-shell.tsx`
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/styles/globals.css`
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/tests/task-controls.test.ts`

**Step 1: Write the failing test**

Add coverage that drift labels/explanation survive storage and are returned in detail payloads.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/task-controls.test.ts`
Expected: FAIL because judge-runs do not persist drift labels yet.

**Step 3: Write minimal implementation**

Add DB columns, row mapping, and UI rendering.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/task-controls.test.ts`
Expected: PASS

### Task 4: Full Verification

**Files:**
- Modify: none unless verification fails

**Step 1: Run full verification**

Run: `npm run check`
Expected: `typecheck`, `test`, and `build` all pass.
