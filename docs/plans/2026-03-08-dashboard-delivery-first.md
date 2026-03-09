# Dashboard Delivery-First Implementation Plan

> **For Codex/Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Reorganize the dashboard so the main view highlights active work, queued work, and the latest completed results while older terminal jobs move into a collapsed history section.

**Architecture:** Keep the existing `/api/jobs` contract and add a pure presentation helper that partitions jobs into four buckets: active, queued, recent completed, and history. The dashboard component will render each bucket separately and use native `<details>` for the collapsed history panel.

**Tech Stack:** Next.js App Router, React 19, TypeScript, node:test

---

### Task 1: Lock Grouping Rules With Tests

**Files:**
- Create: `tests/dashboard-presentation.test.ts`
- Modify: `src/lib/presentation.ts`

**Step 1: Write the failing test**

Add tests asserting:
- `running / paused / manual_review` go to `active`
- `pending` goes to `queued`
- only the most recent 3 `completed` jobs go to `recentCompleted`
- remaining `completed / failed / cancelled` go to `history`

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/dashboard-presentation.test.ts`
Expected: FAIL because the partition helper does not exist yet.

**Step 3: Write minimal implementation**

Add a pure `partitionDashboardJobs()` helper to `presentation.ts`.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/dashboard-presentation.test.ts`
Expected: PASS

### Task 2: Rebuild Dashboard Sections

**Files:**
- Modify: `src/components/dashboard-shell.tsx`
- Modify: `src/styles/globals.css`

**Step 1: Write the failing test**

Reuse the pure grouping helper as the behavior lock; no extra UI test is required for this minimal display-only refactor.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/dashboard-presentation.test.ts`
Expected: Already green from Task 1; use it as regression protection while changing the UI.

**Step 3: Write minimal implementation**

Render four sections:
- active
- queued
- recent completed
- collapsed history

Update copy and stat cards to match the new product framing.

**Step 4: Run targeted verification**

Run: `npm run typecheck`
Expected: PASS

### Task 3: Full Verification

**Files:**
- Modify: none unless verification fails

**Step 1: Run full project verification**

Run: `npm run check`
Expected: `typecheck`, `test`, and `build` all pass.

**Step 2: Review diff**

Run: `git diff -- src tests docs/plans`
Expected: only dashboard grouping and docs changed.
