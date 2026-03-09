# Multi-Deployment Strategy Implementation Plan

> **For Codex/Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Ship a Docker-first self-hosted deployment path for the current server edition, then prepare clean runtime boundaries for a future Web Local Edition and optional Local Bridge.

**Architecture:** Keep the current Next.js + SQLite + server worker runtime as the production baseline. First add container packaging, persistent-volume conventions, and health checks around the existing server edition. Then extract shared orchestration interfaces so a later browser-local edition can reuse prompt/job semantics without rewriting the current runtime into a fragile hybrid.

**Tech Stack:** Next.js 16, React 19, TypeScript, Node 22.22.x, `node:sqlite`, Docker, Docker Compose, existing node:test suite

---

### Task 1: Add A Container-Safe Runtime Contract

**Files:**
- Create: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/lib/server/runtime-env.ts`
- Create: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/app/api/health/route.ts`
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/lib/server/constants.ts`
- Test: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/tests/runtime-env.test.ts`

**Step 1: Write the failing test**

Add tests for:
- default database path resolves under the working directory,
- `PROMPT_OPTIMIZER_DB_PATH` overrides the default cleanly,
- a runtime helper returns a stable edition label and storage path summary for health checks.

```typescript
test('resolveRuntimeEnv exposes default self-hosted paths', () => {
  delete process.env.PROMPT_OPTIMIZER_DB_PATH
  const runtime = resolveRuntimeEnv('/app')
  expect(runtime.edition).toBe('self-hosted-server')
  expect(runtime.databasePath).toBe('/app/data/prompt-optimizer.db')
})
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/runtime-env.test.ts`
Expected: FAIL because the runtime helper and health shape do not exist yet.

**Step 3: Write minimal implementation**

- add `resolveRuntimeEnv()` in `src/lib/server/runtime-env.ts`,
- make `src/lib/server/constants.ts` delegate database-path resolution through it,
- add `GET /api/health` returning edition, database path, and timestamp without exposing secrets.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/runtime-env.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git -C /Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio add src/lib/server/runtime-env.ts src/app/api/health/route.ts src/lib/server/constants.ts tests/runtime-env.test.ts
git -C /Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio commit -m "feat: add deployment runtime contract"
```

### Task 2: Package The Current Server Edition For Docker

**Files:**
- Create: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/Dockerfile`
- Create: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/.dockerignore`
- Create: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/docker-compose.yml`
- Create: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/.env.example`
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/README.md`
- Test: none (Docker smoke verification)

**Step 1: Write the container contract down before coding**

Document these decisions in the Dockerfile comments and README draft:
- base image `node:22.22-bookworm-slim`,
- multi-stage build,
- app workdir `/app`,
- persisted database volume mounted to `/app/data`,
- default port `3000`,
- health check hits `/api/health`.

**Step 2: Write the minimal packaging**

Implement:
- production Dockerfile using `npm ci`, `npm run build`, and `npm run start`,
- `.dockerignore` excluding `.next`, `node_modules`, local database files, screenshots caches, and git metadata,
- `docker-compose.yml` with a named volume for `/app/data`,
- `.env.example` documenting `PROMPT_OPTIMIZER_DB_PATH=/app/data/prompt-optimizer.db`.

**Step 3: Run Docker smoke verification**

Run:
```bash
docker build -t prompt-optimizer-studio:self-hosted /Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio
docker compose -C /Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio up -d
curl http://localhost:3000/api/health
```

Expected:
- image builds successfully,
- compose starts one app container,
- health endpoint returns JSON with edition and database path,
- a SQLite file is created in the mounted volume after normal use.

**Step 4: Commit**

```bash
git -C /Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio add Dockerfile .dockerignore docker-compose.yml .env.example README.md
git -C /Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio commit -m "feat: add docker self-hosted deployment"
```

### Task 3: Polish Self-Hosted Deployment Documentation

**Files:**
- Create: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/docs/deployment/docker-self-hosted.md`
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/README.md`
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/docs/open-source-launch.md`
- Test: none (docs review + command validation)

**Step 1: Add the missing operator guidance**

Document:
- local repo run vs Docker run,
- where data lives in each self-hosted shape,
- how users update Docker deployments,
- why current builds are not yet `Web Local Edition`.

**Step 2: Validate all commands**

Run each command exactly as documented:
```bash
npm run dev
npm run check
docker compose up -d
docker compose logs --tail=50
```

Expected:
- each documented command is valid,
- no README command references a nonexistent deployment artifact,
- current release positioning remains consistent across README and launch copy.

**Step 3: Commit**

```bash
git -C /Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio add docs/deployment/docker-self-hosted.md README.md docs/open-source-launch.md
git -C /Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio commit -m "docs: add docker deployment guide"
```

### Task 4: Extract Shared Runtime Boundaries For Future Editions

**Files:**
- Create: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/lib/runtime/types.ts`
- Create: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/lib/runtime/job-store.ts`
- Create: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/lib/runtime/task-runner.ts`
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/lib/server/jobs.ts`
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/lib/server/worker.ts`
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/lib/engine/optimization-cycle.ts`
- Test: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/tests/task-runner.test.ts`

**Step 1: Write the failing test**

Add tests for:
- a runtime-neutral task runner can advance one round with injected adapters,
- the runner preserves current semantics for `paused`, `step`, `manual_review`, and `completed`,
- next-round steering is consumed once and reviewer isolation still holds.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/task-runner.test.ts`
Expected: FAIL because runtime-neutral interfaces do not exist yet.

**Step 3: Write minimal implementation**

Create small interfaces for:
- job persistence,
- worker lifecycle hooks,
- runtime-neutral task execution.

Keep `src/lib/server/worker.ts` as the server adapter over the new abstractions. Do not change user-visible semantics.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/task-runner.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git -C /Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio add src/lib/runtime/types.ts src/lib/runtime/job-store.ts src/lib/runtime/task-runner.ts src/lib/server/jobs.ts src/lib/server/worker.ts src/lib/engine/optimization-cycle.ts tests/task-runner.test.ts
git -C /Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio commit -m "refactor: extract runtime-neutral task runner"
```

### Task 5: Scaffold Browser-Local Storage And Migration Metadata

**Files:**
- Create: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/lib/web-local/schema.ts`
- Create: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/lib/web-local/indexeddb-store.ts`
- Create: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/lib/web-local/import-export.ts`
- Test: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/tests/web-local-store.test.ts`

**Step 1: Write the failing test**

Add tests covering:
- schema version metadata exists,
- jobs/candidates/settings can be serialized into a browser-local snapshot format,
- import/export preserves task controls including `runMode`, `maxRoundsOverride`, and `nextRoundInstruction`.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/web-local-store.test.ts`
Expected: FAIL because browser-local storage scaffolding does not exist yet.

**Step 3: Write minimal implementation**

Implement:
- a typed schema descriptor,
- an IndexedDB-backed store wrapper or a small interface-compatible stub,
- import/export helpers for backup and migration.

Do not wire it into the main UI yet; keep this as an internal foundation layer.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/web-local-store.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git -C /Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio add src/lib/web-local/schema.ts src/lib/web-local/indexeddb-store.ts src/lib/web-local/import-export.ts tests/web-local-store.test.ts
git -C /Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio commit -m "feat: scaffold web local storage layer"
```

### Task 6: Build A Narrow Web Local MVP Entry Path

**Files:**
- Create: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/components/web-local-app.tsx`
- Create: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/app/web-local/page.tsx`
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/README.md`
- Modify: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/docs/plans/2026-03-09-web-local-edition-design.md`
- Test: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/tests/web-local-entry.test.ts`

**Step 1: Write the failing test**

Add tests asserting:
- the Web Local entry path is clearly marked experimental,
- it does not claim universal provider compatibility,
- it preserves final-prompt-first presentation and existing task controls in its data model.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/web-local-entry.test.ts`
Expected: FAIL because no web-local entry path exists yet.

**Step 3: Write minimal implementation**

Create a separate experimental route that boots browser-local state and reuses the existing control-room presentation patterns where practical. Keep copy explicit that this is a future-facing MVP and not yet a universal replacement for the server edition.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/web-local-entry.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git -C /Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio add src/components/web-local-app.tsx src/app/web-local/page.tsx README.md docs/plans/2026-03-09-web-local-edition-design.md tests/web-local-entry.test.ts
git -C /Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio commit -m "feat: add experimental web local entry"
```

### Task 7: Add An Optional Local Bridge Compatibility Spike

**Files:**
- Create: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/docs/deployment/local-bridge.md`
- Create: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/src/lib/web-local/provider-compatibility.ts`
- Test: `/Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio/tests/provider-compatibility.test.ts`

**Step 1: Write the failing test**

Add tests for a compatibility classifier that labels provider access modes as:
- `direct-browser-ok`,
- `server-recommended`,
- `bridge-required`.

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/provider-compatibility.test.ts`
Expected: FAIL because no compatibility classifier exists yet.

**Step 3: Write minimal implementation**

Implement a narrow compatibility helper and document bridge triggers, but do not ship a bridge binary yet. The goal is to make Web Local product messaging truthful before any bridge is built.

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/provider-compatibility.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git -C /Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio add docs/deployment/local-bridge.md src/lib/web-local/provider-compatibility.ts tests/provider-compatibility.test.ts
git -C /Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio commit -m "docs: define local bridge compatibility rules"
```

### Task 8: Full Verification And Release Readiness Review

**Files:**
- Modify: none unless verification fails

**Step 1: Run targeted tests**

Run:
```bash
npm test -- tests/runtime-env.test.ts tests/task-runner.test.ts tests/web-local-store.test.ts tests/web-local-entry.test.ts tests/provider-compatibility.test.ts
```

Expected: PASS

**Step 2: Run full project verification**

Run:
```bash
npm run check
```

Expected: `typecheck`, `test`, and `build` all pass.

**Step 3: Re-run deployment smoke checks**

Run:
```bash
docker build -t prompt-optimizer-studio:self-hosted /Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio
docker compose -C /Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio up -d
docker compose -C /Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio ps
curl http://localhost:3000/api/health
```

Expected:
- image builds cleanly,
- compose service stays healthy,
- health endpoint responds,
- persistent data directory remains mounted and writable.

**Step 4: Review final diff**

Run:
```bash
git -C /Volumes/1TB_No.1/Dev_Workspace/prompt-optimizer-studio diff -- Dockerfile docker-compose.yml .env.example README.md docs src tests
```

Expected: Only deployment, runtime-boundary, and Web Local groundwork files changed.
