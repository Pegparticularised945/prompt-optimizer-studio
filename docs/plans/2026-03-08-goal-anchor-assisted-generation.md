# Goal Anchor Assisted Generation Implementation Plan

> **For Codex/Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Generate a more professional initial `goalAnchor` during job creation while keeping a safe fallback to the current local derivation.

**Architecture:** Add a dedicated `goalAnchor` generation prompt and CPAMC request path that runs during `createJobs()`. If the request succeeds and returns valid JSON, persist that anchor; otherwise fall back to the existing local `deriveGoalAnchor()` helper so job creation remains reliable.

**Tech Stack:** Next.js App Router, TypeScript, Node SQLite, CPAMC adapter, node:test

---

### Task 1: Add Goal Anchor Generation Prompt

**Files:**
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/lib/server/prompting.ts`
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/lib/server/model-adapter.ts`
- Test: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/tests/prompting.test.ts`

**Step 1: Write the failing test**

Add a test for a dedicated goal-anchor-generation prompt that:
- preserves the original task
- requests `goal / deliverable / driftGuard`
- forbids generic safety drift

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/prompting.test.ts`
Expected: FAIL because the generation prompt does not exist yet.

**Step 3: Write minimal implementation**

Add a `buildGoalAnchorPrompts()` helper and a small adapter method that requests this JSON shape.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/prompting.test.ts`
Expected: PASS

### Task 2: Use Assisted Generation During Job Creation

**Files:**
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/lib/server/jobs.ts`
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/tests/task-controls.test.ts`

**Step 1: Write the failing test**

Add tests for:
- successful assisted generation
- fallback to `deriveGoalAnchor()` when generation throws

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/task-controls.test.ts`
Expected: FAIL because `createJobs()` currently always uses local derivation.

**Step 3: Write minimal implementation**

Wrap generation in try/catch and fall back on any failure.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/task-controls.test.ts`
Expected: PASS

### Task 3: Full Verification

**Files:**
- Modify: none unless verification fails

**Step 1: Run targeted tests**

Run: `npm test -- tests/goal-anchor.test.ts tests/prompting.test.ts tests/task-controls.test.ts`
Expected: PASS

**Step 2: Run full verification**

Run: `npm run check`
Expected: `typecheck`, `test`, and `build` all pass.
