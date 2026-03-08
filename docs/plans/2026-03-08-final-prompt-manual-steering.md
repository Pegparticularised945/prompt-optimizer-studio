# Final Prompt And Manual Steering Implementation Plan

> **For Codex/Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Make the job detail page deliver the latest full prompt as the primary output and allow users to save one-shot manual steering for the next optimizer round.

**Architecture:** Add a task-level `nextRoundInstruction` field with an update timestamp so the worker can consume it exactly once without deleting newer edits made during a running round. Keep the existing lightweight optimizer context: current full prompt + compact review patch + one-shot steering, while reviewer input stays isolated.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Node SQLite, existing worker loop, node:test

---

### Task 1: Persist Next-Round Steering

**Files:**
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/lib/server/types.ts`
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/lib/server/db.ts`
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/lib/server/jobs.ts`
- Test: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/tests/task-controls.test.ts`

**Step 1: Write the failing test**

Add assertions for:
- `nextRoundInstruction` defaults to `null`
- saving a non-empty instruction persists it
- saving an empty instruction clears it

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/task-controls.test.ts`
Expected: FAIL because the field and save path do not exist yet.

**Step 3: Write minimal implementation**

Add DB columns, map them into `JobRecord`, and add a `updateJobNextRoundInstruction()` helper in `jobs.ts`.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/task-controls.test.ts`
Expected: PASS

### Task 2: Feed Steering To Optimizer Only

**Files:**
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/lib/server/prompting.ts`
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/lib/server/model-adapter.ts`
- Test: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/tests/prompting.test.ts`

**Step 1: Write the failing test**

Add tests asserting:
- optimizer prompt includes the saved next-round steering
- judge prompt does not include the saved steering

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/prompting.test.ts`
Expected: FAIL because steering is not currently wired into prompt construction.

**Step 3: Write minimal implementation**

Extend optimizer prompt input to include a single `nextRoundInstruction` string and render it as a dedicated “next round steering” section. Keep judge prompts unchanged.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/prompting.test.ts`
Expected: PASS

### Task 3: Consume Steering Exactly Once

**Files:**
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/lib/server/jobs.ts`
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/lib/server/worker.ts`
- Test: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/tests/task-controls.test.ts`

**Step 1: Write the failing test**

Add coverage for:
- worker reads the instruction for the next round
- consumed instruction is cleared after the round
- if user rewrites instruction during a running round, the newer value is preserved

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/task-controls.test.ts`
Expected: FAIL because there is no consume-and-clear workflow yet.

**Step 3: Write minimal implementation**

Return steering metadata from the worker seed lookup, then add a compare-and-clear helper using the saved update timestamp.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/task-controls.test.ts`
Expected: PASS

### Task 4: Promote Latest Full Prompt In Presentation

**Files:**
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/lib/presentation.ts`
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/components/job-detail-shell.tsx`
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/styles/globals.css`
- Test: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/tests/presentation.test.ts`

**Step 1: Write the failing test**

Add a helper test for:
- latest full prompt prefers newest candidate
- fallback is raw prompt when no candidate exists

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/presentation.test.ts`
Expected: FAIL because no helper exists yet.

**Step 3: Write minimal implementation**

Add a presentation helper for resolving the latest full prompt, then render a prominent top-of-page card with copy action in the job detail UI.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/presentation.test.ts`
Expected: PASS

### Task 5: Add Steering Controls To Job Detail

**Files:**
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/components/job-detail-shell.tsx`
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/app/api/jobs/[id]/route.ts`
- Test: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/tests/task-controls.test.ts`

**Step 1: Write the failing test**

Add assertions covering API persistence of `nextRoundInstruction`.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/task-controls.test.ts`
Expected: FAIL because the PATCH route does not handle steering yet.

**Step 3: Write minimal implementation**

Allow `PATCH /api/jobs/:id` to save `nextRoundInstruction`, then add a textarea plus save action in the detail page. Keep copy focused on “only affects next round, not written directly into the prompt body.”

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/task-controls.test.ts`
Expected: PASS

### Task 6: Full Verification

**Files:**
- Modify: none unless verification fails

**Step 1: Run targeted tests**

Run: `npm test -- tests/prompting.test.ts tests/presentation.test.ts tests/task-controls.test.ts`
Expected: PASS

**Step 2: Run full project verification**

Run: `npm run check`
Expected: `typecheck`, `test`, and `build` all pass.

**Step 3: Review final diff**

Run: `git -C /Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio diff -- src tests docs/plans`
Expected: Only files related to full prompt delivery and next-round steering changed.
