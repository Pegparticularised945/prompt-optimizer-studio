# Prompt Optimizer Studio Open-Source Release Hardening Design

## Summary

This design prepares the current repository for a truthful public GitHub release.

The goal is not to change product semantics. The goal is to remove private-machine assumptions, reduce internal-only repository noise, and add the minimum open-source contribution and security guidance needed for a public repo.

## Current Problems

The repository is close to publishable, but still has four release-hardening gaps:
- prompt pack loading depends on a private local absolute path under `a private local path`,
- an internal handoff file is still present in `docs/`,
- several planning documents expose local machine paths that are fine for internal use but noisy for public release,
- common open-source support files are still missing.

## Options Considered

### Option 1 - Recommended: vendor the default prompt pack into the repository

Pros:
- public clones work without hidden local setup,
- Docker, local dev, and CI all read the same default prompt resources,
- we can still keep an optional override path later if needed.

Cons:
- repository now owns the prompt-pack source files explicitly.

### Option 2 - environment-variable-only override

Pros:
- smaller code change.

Cons:
- public users still cannot run the app safely without extra setup,
- not acceptable for a clean public release.

### Option 3 - precompiled snapshot only

Pros:
- stable runtime behavior.

Cons:
- weaker maintainability and readability than storing the source markdown files directly.

## Recommendation

Choose Option 1.

Ship a repo-local default prompt pack, make runtime loading relative to the repository, and keep product behavior unchanged.

## Design

### 1. Prompt Pack Packaging

Add a repository-owned prompt pack resource directory that contains:
- `SKILL.md`
- `references/rubric.md`
- `references/universal-template.md`

Then update prompt-pack resolution so the public repo defaults to those checked-in files instead of a machine-local path.

Important constraint:
- no provider-internal path details are shown in the user-facing UI,
- no change to optimizer/reviewer semantics,
- no change to final-prompt-first behavior.

### 2. Public Docs Hygiene

Remove the internal handoff document from the public tree:
- `docs/HANDOFF_2026-03-08.md`

Keep the planning docs, but convert absolute machine paths and local worktree references into repository-relative paths or plain commands.

This preserves useful development history without exposing private workstation layout.

### 3. Open-Source Meta Files

Add:
- `CONTRIBUTING.md`
- `SECURITY.md`

Keep them short and practical:
- contribution flow,
- verification expectations,
- how to report security issues privately.

## Testing Strategy

Add or update tests so public-release hardening is behavior-locked:
- prompt pack can be read from repo-local files,
- runtime no longer depends on a private absolute path,
- docs cleanup does not break build or test flows.

Then run:
- `npm run check`
- `docker build ...` smoke check if prompt-pack packaging touches runtime image behavior.

## Non-Goals

This work will not:
- change task-control semantics,
- change pause / step / resume / max-round behavior,
- change reviewer isolation rules,
- promote Web Local beyond its current truthful status,
- refactor unrelated UI or backend areas.
