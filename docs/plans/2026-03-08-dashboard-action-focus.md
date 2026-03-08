# Dashboard Action Focus Implementation Plan

> **For Codex/Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Add a one-click “only show what I need to handle now” dashboard mode and visually prioritize `manual_review` and `paused` jobs over normal running work.

**Architecture:** Keep the current grouped dashboard, then add pure helpers for active-job priority sorting and view filtering. The dashboard component owns a single local toggle state and conditionally renders sections based on that derived view.

**Tech Stack:** Next.js App Router, React 19, TypeScript, node:test

---

### Task 1: Lock Priority Sorting And Focus Mode

**Files:**
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/tests/dashboard-presentation.test.ts`
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/lib/presentation.ts`

**Step 1: Write the failing test**

Add tests asserting:
- active jobs sort as `manual_review -> paused -> running`
- focus mode keeps only active jobs and clears queued/recent/history

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/dashboard-presentation.test.ts`
Expected: FAIL because the helpers do not exist yet.

**Step 3: Write minimal implementation**

Add pure helpers for:
- active job prioritization
- actionable-only dashboard view

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/dashboard-presentation.test.ts`
Expected: PASS

### Task 2: Implement Dashboard Toggle And Card Emphasis

**Files:**
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/components/dashboard-shell.tsx`
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/styles/globals.css`

**Step 1: Keep tests green while refactoring**

Run: `npm test -- tests/dashboard-presentation.test.ts`
Expected: PASS before UI changes.

**Step 2: Write minimal implementation**

Add:
- local `actionableOnly` toggle state
- conditional rendering to hide non-actionable sections when enabled
- priority classes for `manual_review`, `paused`, `running`

**Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

### Task 3: Full Verification

**Files:**
- Modify: none unless verification fails

**Step 1: Run full verification**

Run: `npm run check`
Expected: `typecheck`, `test`, and `build` all pass.
