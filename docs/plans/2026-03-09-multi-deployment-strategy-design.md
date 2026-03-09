# Prompt Optimizer Studio Multi-Deployment Strategy Design

## Summary

This document defines how Prompt Optimizer Studio should expand from a single self-hosted runtime into a clear multi-deployment product line without rewriting the current app into an unstable hybrid.

Recommended direction:
- keep the current repository truthfully positioned as the `Self-Hosted / Server Edition`,
- ship a first-class `Docker` path for that edition before open-source growth accelerates,
- design a future `Web Local Edition` as a hosted frontend with browser-local data,
- add an optional `Local Bridge` only if browser networking constraints make it necessary.

This sequencing matches the current codebase reality:
- Next.js server routes,
- machine-local SQLite via `node:sqlite`,
- background worker loops started from the server runtime,
- OpenAI-compatible Base URL and API key settings stored in the running environment.

It also preserves the product rules already validated in this repo:
- final full prompt is the main artifact,
- pause / continue one round / resume auto / task max-round override stay first-class,
- reviewer does not see historical aggregated issue lists,
- optimizer only receives the current full prompt, slim patch, and optional one-shot next-round steering,
- provider-internal paths are not exposed in the user-facing UI,
- the UI continues to show a single task-friendly model alias rather than surfacing optimizer/reviewer wiring complexity.

## Goals

- Make open-source onboarding easier with a low-friction self-hosted deployment story.
- Preserve the current stable server-side runtime instead of forcing a risky rewrite.
- Support the user's desire for broader deployment choice, including `Docker` and a future online experience.
- Keep the documentation honest about where data lives in each edition.
- Create a future path where frontend updates can reach hosted users automatically.
- Preserve current optimization semantics across editions so the product does not behave differently depending on deployment shape.

## Non-Goals

- Do not claim that the current repository already ships a browser-local hosted product.
- Do not merge server-backed and browser-local execution into one runtime immediately.
- Do not add a paid hosted inference proxy by default.
- Do not reintroduce multi-judge parallel architecture or other unrelated runtime changes.
- Do not expose provider-specific internal routing details in the UI just to support more deployment modes.

## Current Reality

The current app is a server-backed local-first product, not a static frontend.

Concrete runtime facts from the repository today:
- persistence is provided by `src/lib/server/db.ts` using `DatabaseSync` and a file-backed SQLite database,
- the default database path resolves to `data/prompt-optimizer.db` under the server working directory unless `PROMPT_OPTIMIZER_DB_PATH` is set,
- background work is driven by `src/lib/server/worker.ts`, which claims jobs, runs optimization cycles, and updates state,
- API routes under `src/app/api/**` start and depend on the server worker,
- settings such as Base URL, API key, default models, and runtime policy are stored in the local database.

Implication:
- when run locally, data lives on the local machine,
- when run on a VPS or inside Docker, data lives wherever that deployment persists the SQLite file,
- therefore the current release should be described as `self-hosted`, not `browser-local hosted`.

## Product Problem To Solve

The product now has three different distribution needs, and each one optimizes for a different tradeoff:

1. `Self-Hosted / Server Edition`
- best compatibility with arbitrary OpenAI-compatible Base URLs,
- best fit for the current worker + SQLite architecture,
- easiest to trust operationally,
- but users update only when they pull new code or new images.

2. `Hosted Web Local Edition`
- users get the latest UI without reinstalling,
- application data can stay in browser storage,
- static hosting can keep operator cost low,
- but browser environments cannot reach every OpenAI-compatible endpoint due to CORS, auth, and networking policy.

3. `Optional Local Bridge`
- can restore compatibility for browser-hosted users when a provider blocks direct browser access,
- can keep secrets on the user's own machine instead of the hosted origin,
- but adds another component to install, version, and support.

Trying to collapse all three goals into one implementation too early would create product confusion and technical fragility.

## Options Considered

### Option 1: Stay Repo-Only And Manual

Shape:
- keep the current self-hosted edition,
- provide `npm install` / `npm run dev` only,
- do not add Docker or hosted web-local work yet.

Pros:
- lowest short-term engineering cost,
- keeps current behavior unchanged,
- no new deployment artifacts.

Cons:
- weak open-source adoption path,
- harder to recommend to users who expect one-command deployment,
- does not address the user's explicit desire for Docker and future web delivery.

### Option 2: Recommended Product Matrix

Shape:
- current repo remains the self-hosted server edition,
- add Docker as the default deployment path for that edition,
- design a future hosted web-local edition as a separate runtime target sharing product semantics,
- add an optional local bridge only if compatibility demands it.

Pros:
- honest about what ships today,
- gives open-source users a strong Docker-first on-ramp,
- preserves the current reliable server worker model,
- creates a credible path toward online updates for hosted users,
- lets browser-local support grow without destabilizing the current product.

Cons:
- requires maintaining more than one deployment story,
- future shared-runtime extraction must be done carefully,
- bridge support adds long-term support burden if adopted.

### Option 3: Force A Unified Hybrid Runtime Now

Shape:
- immediately refactor the current app to run both as self-hosted server and browser-local hosted app from one execution model.

Pros:
- one visible product story on paper.

Cons:
- highest engineering risk,
- large runtime rewrite before open-source stabilization,
- easy to regress the current worker, state flow, and task controls,
- likely to create misleading documentation while the architecture is still in transition.

## Recommendation

Choose Option 2.

### Recommended Product Matrix

| Edition | Runtime | Where Data Lives | Update Model | Provider Reach | Best For |
| --- | --- | --- | --- | --- | --- |
| Self-Hosted / Server Edition | Next.js server + SQLite + worker | Machine or server volume running the app | Manual repo/image upgrade | Broadest OpenAI-compatible reach the server can access | Open-source users, private deployments, reliable long-running jobs |
| Self-Hosted / Server Edition via Docker | Same runtime packaged in a container | Docker-mounted volume, typically `/app/data` | Pull new image and restart | Same as server edition | Fast deployment, GitHub users, small teams |
| Hosted Web Local Edition (future) | Hosted frontend + IndexedDB + browser runner / Web Worker | User browser storage | Centralized frontend deployment | Only direct-browser-compatible endpoints unless bridge exists | Low-friction online use, instant UI updates |
| Optional Local Bridge (future) | Small local helper process paired with hosted web app | Bridge config on user machine, task data still browser-local | Bridge binary/version update | Restores many blocked providers for hosted users | Users needing browser-local UX with non-CORS providers |

## Why Docker First

Docker should be the first deployment expansion because it solves the highest-value problem with the lowest product risk.

Why it comes first:
- It matches the current runtime exactly instead of requiring a new execution model.
- It improves GitHub onboarding immediately.
- It makes the current self-hosted positioning stronger and easier to explain.
- It supports VPS, NAS, home server, and team internal deployment without changing task semantics.
- It preserves the broadest compatibility for arbitrary OpenAI-compatible Base URLs because requests originate from the server container, not a browser sandbox.

Expected operator story:
- provide `docker compose up -d`,
- mount a persistent data volume,
- configure Base URL and API key through the app,
- upgrade later by pulling a newer image.

Important product truth:
- Docker users do not receive automatic product updates from us.
- They receive new versions when they pull the updated image and restart.

## Why Web Local Second

`Web Local Edition` still matters, but it should follow Docker because its constraints are fundamentally different from the current architecture.

What it unlocks:
- online access to the latest UI,
- zero server-side task persistence,
- lower hosting cost if we only ship static assets,
- immediate rollout of frontend improvements.

What makes it second-phase work:
- the current SQLite-backed repositories cannot be reused directly,
- the current server worker loop cannot simply be moved into a browser tab,
- browser background execution is less reliable than a server process,
- browser-access to model providers is narrower than server-access,
- browser-side key storage has different trust and security implications.

Therefore the right strategy is:
- extract shared prompt/job semantics first,
- keep storage and worker execution behind adapters,
- then introduce browser-local storage and browser-runner behavior as a separate edition target.

## Why The Optional Local Bridge Stays Optional

A bridge should only exist if the hosted browser-local edition proves valuable enough and direct browser provider access proves too limiting.

When a bridge is justified:
- an important provider blocks CORS,
- users want browser-local tasks but do not want API keys persisted in the hosted origin,
- browser networking limitations materially reduce the usefulness of Web Local Edition.

When a bridge is not justified:
- direct browser-compatible providers already cover most user needs,
- the added installation step would hurt adoption more than it helps,
- support burden would outweigh compatibility gains.

Recommended rule:
- do not lead with the bridge in README or product positioning,
- treat it as a compatibility add-on for the hosted edition, not as the default product shape.

## Shared Product Semantics Across Editions

All editions should preserve the same user-visible operating model.

These rules should remain invariant:
- the primary output is always the latest full prompt, not a patch log,
- the task detail view keeps pause, continue one round, resume auto, retry, cancel, next-round steering, and max-round override,
- next-round steering is a one-shot instruction for the next optimizer round only,
- reviewer remains isolated from historical aggregated issue lists and steering text,
- optimizer continues to receive the compact context budget already established in this repo,
- the UI shows one task-level model alias and does not expose provider-internal paths.

If a future edition cannot uphold those rules, it should be treated as incomplete rather than shipped with weaker semantics.

## Connectivity And Provider Compatibility Rules

The user wants support for all Base URLs and APIs, but the deployment model determines how close we can get to that goal.

### Self-Hosted Server / Docker

This edition can support the broadest OpenAI-compatible range because the server is the network client.

Expectation:
- any reachable OpenAI-compatible endpoint can work,
- the UI still only exposes `Base URL` and `API Key`,
- provider-specific internal route details stay hidden.

### Hosted Web Local Edition

This edition cannot honestly promise universal compatibility.

Reality:
- some providers block browser-origin requests,
- some require headers or policies unsuitable for direct browser calls,
- some users will not want keys stored in browser-local persistence.

Therefore the product copy must say:
- `Web Local Edition` supports direct-browser-compatible endpoints,
- broader compatibility may require an optional local bridge.

This keeps the promise truthful without weakening the self-hosted story.

## Update Strategy Across Editions

One earlier product question was whether future updates can be delivered to all users.

The answer depends on edition:

### Self-Hosted Repo Users
- update by pulling the latest code and re-running install/build steps.

### Self-Hosted Docker Users
- update by pulling the latest image and restarting the container.

### Hosted Web Local Users
- receive new frontend builds automatically when the hosted deployment updates,
- local browser data survives only if schema migrations succeed,
- this edition needs explicit migration/version handling before it can ship safely.

This should be documented plainly so users understand that only the hosted browser-local edition provides centralized frontend update rollout.

## Repository And Documentation Shape

Recommended documentation structure:
- `README.md`
  - present the current repo as `Self-Hosted / Server Edition`,
  - add `Docker` as the recommended deployment path once implemented,
  - describe `Web Local Edition` as planned.
- `docs/open-source-launch.md`
  - keep GitHub release/about copy aligned with the same truth.
- `docs/plans/2026-03-09-web-local-edition-design.md`
  - continue as the focused design for browser-local behavior.
- `docs/plans/2026-03-09-multi-deployment-strategy-design.md`
  - serve as the master deployment strategy.
- future deployment docs:
  - `docs/deployment/docker-self-hosted.md`
  - `docs/deployment/web-local-edition.md`
  - `docs/deployment/local-bridge.md` only if the bridge is implemented.

Recommended repository strategy:
- keep one repo for now,
- do not split into multiple repos until the Web Local runtime is proven,
- share semantics through interfaces and adapters rather than by forcing one runtime to fake another.

## Risks And Tradeoffs

### Docker Risks
- users may assume containers auto-update when they do not,
- persistent volume paths must be documented carefully,
- SQLite locking and file permissions need a predictable container path.

### Web Local Risks
- browser suspension can interrupt long-running tasks,
- IndexedDB migrations must be robust,
- key storage and provider compatibility are more sensitive than on a server,
- browser-only execution may feel less reliable for long optimization loops.

### Bridge Risks
- another artifact to install and support,
- version mismatch risk between hosted app and local bridge,
- support surface expands across OS packaging and local networking.

### Product Messaging Risk
- the biggest avoidable mistake is implying that current self-hosted builds already behave like browser-local hosted builds.

## Phased Rollout

### Phase 1: Harden Self-Hosted With Docker
- add Docker packaging,
- add a health endpoint and runtime env contract,
- document persistent storage and upgrade flow,
- make Docker the default recommended deployment path for open-source users.

### Phase 2: Extract Shared Runtime Boundaries
- isolate job orchestration semantics from storage and host runtime,
- keep current server behavior unchanged while introducing portable interfaces.

### Phase 3: Build Web Local MVP
- add browser storage,
- add browser-side runner lifecycle,
- support import/export,
- document compatibility limits clearly.

### Phase 4: Decide Whether A Local Bridge Is Needed
- measure direct-browser provider compatibility,
- implement the bridge only if it materially expands usable providers or key-handling trust.

## Final Decision

Prompt Optimizer Studio should open-source and continue evolving as a truthful `Self-Hosted / Server Edition`, with `Docker` as the first deployment-quality upgrade.

`Web Local Edition` remains a planned second runtime target for future centralized frontend updates and browser-local storage.

The optional `Local Bridge` should remain a compatibility escape hatch, not a default requirement.
