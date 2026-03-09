# Open-Source Release Hardening Implementation Plan

> **For Codex/Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Make Prompt Optimizer Studio safe and truthful to publish as a public GitHub repository by removing private-machine dependencies and tightening open-source docs.

**Architecture:** Keep runtime semantics unchanged. Vendor the default prompt pack into the repository, resolve it through a small runtime helper, remove internal-only public docs noise, and add minimal contribution/security meta docs. Treat this as release hardening, not a product refactor.

**Tech Stack:** Next.js 16, React 19, TypeScript, Node 22.22.x, Docker, node:test

---

### Task 1: Vendor The Default Prompt Pack Into The Repository

**Files:**
- Create: `prompt-pack/default/SKILL.md`
- Create: `prompt-pack/default/references/rubric.md`
- Create: `prompt-pack/default/references/universal-template.md`
- Create: `tests/prompt-pack.test.ts`
- Modify: `src/lib/server/constants.ts`
- Modify: `src/lib/server/prompt-pack.ts`

**Step 1: Write the failing test**

Add tests for:
- repo-local prompt pack resolution,
- optional override via env var,
- reading the three required markdown artifacts from the resolved directory.

```typescript
test('resolvePromptPackDir defaults to the repo-local prompt pack', () => {
  delete process.env.PROMPT_OPTIMIZER_PROMPT_PACK_DIR
  assert.match(resolvePromptPackDir(), /prompt-pack\/default$/)
})
```

**Step 2: Run test to verify it fails**

Run: `node --import tsx --test tests/prompt-pack.test.ts`
Expected: FAIL because no runtime helper or repo-local prompt pack exists yet.

**Step 3: Write minimal implementation**

Implement:
- a repo-local default prompt-pack directory,
- `resolvePromptPackDir()` in `src/lib/server/constants.ts`,
- prompt-pack loading in `src/lib/server/prompt-pack.ts` through that helper.

Keep behavior unchanged apart from removing the private-machine dependency.

**Step 4: Run test to verify it passes**

Run: `node --import tsx --test tests/prompt-pack.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add prompt-pack/default src/lib/server/constants.ts src/lib/server/prompt-pack.ts tests/prompt-pack.test.ts
git commit -m "fix: vendor default prompt pack for public release"
```

### Task 2: Remove Internal-Only Public Docs Noise

**Files:**
- Delete: `docs/HANDOFF_2026-03-08.md`
- Modify: `docs/plans/2026-03-09-multi-deployment-strategy.md`
- Modify: `docs/plans/2026-03-08-final-prompt-manual-steering.md`
- Modify: `docs/plans/2026-03-08-goal-anchor-assisted-generation.md`
- Modify: `docs/plans/2026-03-08-goal-anchor-explanation.md`
- Modify: other `docs/plans/*.md` files that still expose absolute machine paths or `worktrees` references

**Step 1: Write the failing docs hygiene check**

Run a repository search for private absolute paths and local worktree references.

Expected: matches in public docs before cleanup.

**Step 2: Remove and sanitize**

Implement:
- remove the internal handoff file,
- replace absolute workstation paths with repo-relative paths,
- replace `worktrees/...` references with neutral repository wording where needed.

Do not remove useful public planning context unless it is purely internal.

**Step 3: Re-run the docs hygiene check**

Run the same repository search again.
Expected: no matches in public docs.

**Step 4: Commit**

```bash
git add docs
git commit -m "docs: sanitize public repository docs"
```

### Task 3: Add Open-Source Contribution And Security Guidance

**Files:**
- Create: `CONTRIBUTING.md`
- Create: `SECURITY.md`
- Modify: `README.md`

**Step 1: Write the minimal docs**

Add:
- `CONTRIBUTING.md` with setup, verification, and PR expectations,
- `SECURITY.md` with private reporting guidance and disclosure expectations,
- a short README section linking to both files.

**Step 2: Validate links and commands**

Run:
```bash
rg -n "CONTRIBUTING|SECURITY" README.md CONTRIBUTING.md SECURITY.md
```

Expected: README references both files and the docs are present.

**Step 3: Commit**

```bash
git add README.md CONTRIBUTING.md SECURITY.md
git commit -m "docs: add open-source contribution guides"
```

### Task 4: Final Public-Release Verification

**Files:**
- Modify: none unless verification fails

**Step 1: Run targeted verification**

Run:
```bash
node --import tsx --test tests/prompt-pack.test.ts
```

Expected: PASS

**Step 2: Run full project verification**

Run:
```bash
npm run check
```

Expected: `typecheck`, `test`, and `build` all pass.

**Step 3: Run Docker smoke verification**

Run:
```bash
docker build -t prompt-optimizer-studio:self-hosted .
docker compose up -d
docker compose ps
curl http://localhost:3000/api/health
docker compose down
```

Expected:
- image builds,
- container becomes healthy,
- health endpoint responds,
- repo-local prompt pack is available inside the image.

**Step 4: Review the final diff**

Run:
```bash
git diff -- prompt-pack README.md CONTRIBUTING.md SECURITY.md docs src tests Dockerfile docker-compose.yml .env.example
```

Expected: only public-release hardening changes are present.
