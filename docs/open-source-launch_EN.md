# Open Source Launch Copy

[Chinese](open-source-launch.md) | **English**

This file keeps copy-ready text for the GitHub repository page and public release materials.

## Repository Name

`prompt-optimizer-studio`

## Positioning

### GitHub About

Automated prompt optimization pipeline with human steering and copy-ready final prompts.

### Short Pitch

Prompt Optimizer Studio turns prompt refinement into an operator-friendly pipeline. Start from a draft prompt, let optimizer and reviewer iterate automatically, step in when the direction drifts, and end with a full prompt you can actually ship.

## Key Messages

- automated, multi-round, pipeline-style prompt optimization
- human steering stays inside the loop instead of outside it
- the final deliverable is the latest full prompt, not a diff log
- round history, drift checks, and stop rules stay visible
- stronger task-creation, task-detail, and runtime-parameter traceability
- multi-provider connectivity with self-hosted Docker deployment

## Release Title

`v0.1.7 - Result Desk & Structure Governance Update`

## Release History

### v0.1.7

Release shape:

- This release remains the **Self-Hosted / Server Edition**.
- Data stays on the machine or deployment environment running the app.
- The public release name is **`v0.1.7`** with no `hotfix` branding.
- This release stays focused on public-path UX fixes, structure governance, and compatibility hardening.

Highlights:

1. **A clearer result desk and round timeline**
   - Job detail and round-run copy has been rewritten into more understandable operator-facing language.
   - Labels such as “Previous prompt score”, “This version was scored later”, and “This version will be scored next round” now align with the current product semantics.
   - Empty states, placeholder MVE copy, and raw upstream error exposure were cleaned up further.

2. **Fixed stop logic for three consecutive passing rounds**
   - Fixed cases where jobs kept opening another round even after satisfying the stop condition.
   - Fixed cases where a job was incorrectly marked failed when the final passing round had no fresh optimizer output.
   - Final delivery now closes correctly around the current public rule of three consecutive passing reviews.

3. **A more consistent stable-rules and task-rubric flow**
   - Auto-running job detail pages still expose the stable-rule adjustment entry.
   - Pending steering can be turned into a stable-rule draft first and only becomes stable rules after an explicit save.
   - Stable rules, pending steering, and task-level rubric overrides are explained more clearly in the UI.

4. **Structure governance and compatibility hardening**
   - Server boundaries are now explicit across `jobs / runtime / providers / settings / prompt-pack / db / goal-anchor`.
   - The OpenAI-compatible `/responses` fallback regression is fixed and covered by regression tests.
   - `check:architecture` and boundary tests now guard against falling back to root-level implicit dependencies and compatibility bridges.

5. **Public prompt-pack cleanup**
   - The default prompt-pack no longer exposes unnecessary version labels or extra technical markers.
   - Public `Create / Debug / Review` mode-fidelity rules are preserved more clearly.

### v0.1.6

Release shape:

- This release remains the **Self-Hosted / Server Edition**.
- Data stays on the machine or deployment environment running the app.
- A separate `Web Local Edition` may come later, but it is not part of this release.

Highlights:

1. **Tighter provider retry boundaries**
   - The app no longer blindly retries explicit upstream auth-unavailable failures.
   - Generic `INTERNAL_ERROR` failures are no longer expanded into repeated retries by default.
   - Retries now stay limited to clearly transient failures such as timeout, gateway, upstream, EOF, and network-style errors.

2. **More truthful runtime failure handling**
   - When the upstream provider is genuinely unavailable, jobs now fail faster instead of hanging at `round 0` for too long.
   - This makes the control room reflect the real failure mode more accurately and makes retry-vs-debug decisions easier.

3. **Regression coverage**
   - Added regression coverage to ensure `auth_unavailable 500` is not retried.
   - Added regression coverage to ensure generic thrown `INTERNAL_ERROR` is not retried.
   - Preserved retry coverage for `504` and timeout/network-style failures so transient resilience is kept intact.

### v0.1.5

Release shape:

- This release remains the **Self-Hosted / Server Edition**.
- Data stays on the machine or deployment environment running the app.
- A separate `Web Local Edition` may come later, but it is not part of this release.

Highlights:

1. **More accurate control-room state visibility**
   - Fixed an issue where jobs without any generated score could still appear as `0.00` in the dashboard.
   - Jobs without a valid score now show `—` with a clearer “No score generated yet” state.
   - The same score-display behavior is now aligned across recent results and history cards.

2. **Friendlier infrastructure error messaging**
   - Added recognition for upstream failure patterns such as `stream error`, `INTERNAL_ERROR`, `received from peer`, and `server_error`.
   - These cases are now normalized into retryable infrastructure/provider failures.
   - Users no longer have to parse raw upstream error payloads directly in the control room.

3. **Regression coverage**
   - Added regression coverage for dashboard cards with no generated score.
   - Added regression coverage for stream/internal provider error classification.
   - This helps keep the maintenance patch small, focused, and stable for public release.

### v0.1.4

Release shape:

- This release remains the **Self-Hosted / Server Edition**.
- Data stays on the machine or deployment environment running the app.
- A separate `Web Local Edition` may come later, but it is not part of this release.

Highlights:

1. **Task-creation interaction fixes**
   - Fixed an issue where the dashboard submission panel could not be expanded again after being collapsed.
   - Fixed a related issue where the page could become blocked by a hidden layer after collapsing the submission panel.
   - The primary path for creating new jobs from the dashboard is now more stable.

2. **Clearer error handling**
   - Gateway and upstream failures such as `504 Gateway Timeout`, `Bad Gateway`, `Cloudflare`, and `upstream` are now recognized more consistently.
   - These cases are now presented as retryable infrastructure failures instead of exposing raw upstream error pages directly to users.
   - It is easier to tell when to retry immediately versus checking the provider, gateway, or network path.

3. **More stable multi-round execution**
   - When a job already has a usable result, later infrastructure failures now preserve more of the current result and execution progress.
   - `step` mode now soft-lands into `paused`.
   - `auto` mode now soft-lands into `manual review`.
   - A later gateway failure no longer has to make the whole job appear fully lost.

4. **Regression coverage**
   - Added coverage for infrastructure error classification.
   - Added coverage for fail-soft behavior in multi-round execution.
   - Added regression coverage for collapsing and re-expanding the dashboard submission panel.

### v0.1.3

Release shape:

- This release remains the **Self-Hosted / Server Edition**.
- Data stays on the machine or deployment environment running the app.
- A separate `Web Local Edition` may come later, but it is not part of this release.

Highlights:

1. **More controllable runtime parameters**
   - Every model can now be configured with a reasoning-effort level.
   - Runtime parameters now travel more cleanly across settings, job creation, job detail, API, and database snapshots.
   - Task-level model and reasoning changes are easier to trace and audit.

2. **Improved task creation and detail experience**
   - The dashboard submission flow can carry key runtime parameters directly into new jobs.
   - The job detail summary now shows `Reasoning effort` instead of lower-value summary metadata.
   - Model selection, parameter editing, and result inspection are more consistent along the main public path.

3. **Clearer result and state visibility**
   - Missing scores, failed states, and best-score displays are presented more clearly.
   - It is easier to tell what state a job actually reached and whether comparable output exists.
   - A set of prompt-understanding and goal-anchor improvements is now aligned into the public path as well.

4. **Stability and audit-chain improvements**
   - Parameter snapshots are more complete across settings, jobs, API, UI, and DB.
   - This release also includes a batch of general fixes around task creation, detail rendering, runtime parameter sync, and runtime stability.
   - The public line stays aligned without pulling in the experiment desk or unverified skill / rubric / prompt-pack semantics.

### v0.1.2

- Added bilingual UI switching.
- Added global and per-job scoring-standard overrides.
- Expanded provider/model connectivity and protocol override support.

### v0.1.1

- Fixed the dashboard crash in environments where `crypto.randomUUID` was unavailable.
- Added a result comparison mode between the initial prompt and the current latest full prompt.
- Hardened invalid round-score handling and clarified related error messages.

### v0.1.0

- First public release.
- Automated prompt optimization pipeline with visible round-by-round progress.
- Final full prompt stays visible and copyable.
- Human steering loop with pause, next-round guidance, continue-one-round, and resume-auto controls.
- Goal-anchor drift guard and reviewer isolation.
- Docker-ready self-hosted deployment with `/api/health`.
- AGPL-3.0-only licensing for source-available hosted modifications.

## Suggested Topics

`prompt-engineering`, `prompt-optimizer`, `automation`, `prompt-pipeline`, `nextjs`, `react`, `typescript`, `sqlite`, `docker`, `openai-compatible`, `anthropic`, `gemini`, `self-hosted`, `developer-tools`, `ai-tooling`
