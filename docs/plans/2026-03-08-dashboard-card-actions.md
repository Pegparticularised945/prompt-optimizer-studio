# Dashboard Card Actions Implementation Plan

> **For Codex/Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Let dashboard cards expose the latest prompt summary, a copy action, and direct resume controls for paused/manual-review jobs.

**Architecture:** Extend the dashboard job payload with a lightweight `latestPrompt` field derived from the latest candidate or raw prompt. The dashboard card then renders a short summary, copies the full `latestPrompt`, and calls existing resume APIs for actionable statuses.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Node SQLite, node:test

---

### Task 1: Lock Latest Prompt Derivation

**Files:**
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/tests/presentation.test.ts`
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/lib/presentation.ts`

**Step 1: Write the failing test**

Add a test for prompt preview/summary derivation from `latestPrompt`.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/presentation.test.ts`
Expected: FAIL because the helper does not exist yet.

**Step 3: Write minimal implementation**

Add a pure helper that shortens the latest prompt for card display.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/presentation.test.ts`
Expected: PASS

### Task 2: Expose Latest Prompt In Dashboard Job Payload

**Files:**
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/lib/server/jobs.ts`
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/components/dashboard-shell.tsx`
- Test: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/tests/task-controls.test.ts`

**Step 1: Write the failing test**

Add coverage that job listing surfaces a `latestPrompt` derived from the newest candidate or raw prompt.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/task-controls.test.ts`
Expected: FAIL because `listJobs()` does not expose `latestPrompt`.

**Step 3: Write minimal implementation**

Join latest candidate prompt into the list query mapping.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/task-controls.test.ts`
Expected: PASS

### Task 3: Add Dashboard Card Actions

**Files:**
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/components/dashboard-shell.tsx`
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/styles/globals.css`

**Step 1: Keep tests green**

Run: `npm test -- tests/presentation.test.ts tests/task-controls.test.ts`
Expected: PASS

**Step 2: Write minimal implementation**

Add:
- latest prompt summary block
- copy button
- `resume-step` and `resume-auto` buttons for `manual_review / paused`
- detail link to the steering area

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

### Task 4: Full Verification

**Files:**
- Modify: none unless verification fails

**Step 1: Run full verification**

Run: `npm run check`
Expected: `typecheck`, `test`, and `build` all pass.
