## Goal

Rewrite the public README files so they describe the current product behavior truthfully and in plain language.

## Why this change

The existing README drifted away from the real runtime semantics in four places:

1. It implied a simple "optimize first, then score the result" loop.
2. It did not explain the fixed "three consecutive passing reviewed rounds" stop rule clearly.
3. It flattened temporary steering and stable rules into a single vague concept.
4. It described OpenAI-compatible support too narrowly as only `/chat/completions`.

## Scope

- Update `README.md`
- Update `README_EN.md`
- Keep the release-facing tone grounded and public-safe
- Do not add internal experiment names, compare language, or private release hygiene notes

## Runtime truths to reflect

### Round semantics

- Each round starts from the current full prompt.
- The system schedules two operations around that same input prompt:
  - review the current input prompt
  - generate the next full prompt
- The generated output is reviewed in the next round, not the same round.
- Runtime may choose parallel or sequential execution depending on provider capability and stability conditions.

### Stop rule

- The score threshold is user-configurable.
- Completion currently requires three consecutive passing reviewed rounds.
- A passing round means `score >= threshold` and no material issues.
- If the third passing reviewed round also produced a new output, that new output becomes the final delivery.
- If the third passing reviewed round had no new output, the already reviewed passing input becomes the final delivery.

### Steering and stable rules

- Pending steering is a next-round-only addition.
- Review does not see the raw steering text.
- Selected pending steering can be turned into a stable-rule draft.
- Stable rules change only after explicit save.

### Provider description boundary

- Public docs should say OpenAI-compatible gateways use capability-aware routing and fallback behavior.
- Do not claim the product only depends on `/chat/completions`.

## Verification

- `git diff --check`
- search README files for internal experiment terms and outdated semantics
