# GitHub Bilingual Docs Refresh Design

## Summary

The repository should present itself first as an automated prompt optimization pipeline, not merely a self-hosted prompt workbench. The public GitHub face should default to English for broader open-source reach, while Chinese readers should get a complete mirror path instead of mixed-language documents.

## Decisions

- Use `README.md` as the English default landing page.
- Add `README_ZH.md` as the full Chinese mirror.
- Keep `README_EN.md` as a lightweight compatibility bridge.
- Make default governance and deployment docs English-only in standard filenames.
- Create `_ZH` mirrors for the core docs Chinese readers will actually open.
- Use same-language links throughout each doc chain.
- Put the workflow explanation into Mermaid diagrams so the automation loop is visible in both languages.

## Scope

In scope:

- GitHub README positioning
- language-consistent doc navigation
- launch, deployment, contribution, conduct, and security docs
- issue-template copy cleanup where it reduces mixed-language noise

Out of scope:

- GitHub UI language beyond repository-controlled markdown and issue templates
- product runtime changes
- website or GitHub Pages redesign
