# GitHub Bilingual Docs Refresh Implementation Plan

> **For Codex/Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Reposition the public GitHub repository around automated pipeline prompt optimization and make the core docs fully language-consistent for English and Chinese readers.

**Architecture:** Keep GitHub-native docs simple: use English as the default repository landing language in standard filenames, create Chinese mirror files with `_ZH` suffixes, and ensure each doc links only to same-language neighbors. Refresh the README structure so the first screen sells the automation loop, the second screen explains the workflow with Mermaid, and the rest of the page supports deployment and governance.

**Tech Stack:** Markdown, GitHub README rendering, Mermaid flowcharts, existing repository docs.

---

### Task 1: Reset the public README information architecture

**Files:**
- Modify: `README.md`
- Modify: `README_EN.md`

**Step 1: Write the new section order in the docs first**
- Define the final README structure: hero pitch, operator promises, workflow diagram, differentiators, screenshots, quick start, configuration, deployment model, FAQ, license.

**Step 2: Switch the default landing strategy**
- Use `README.md` as the English default landing page for GitHub.
- Convert the existing Chinese README into a mirror document instead of the primary landing page.

**Step 3: Rewrite the hero and positioning copy**
- Lead with automated, multi-round, pipeline-style prompt optimization.
- Keep “copy-ready final full prompt” and “human steering in the loop” in the first screen.

**Step 4: Add mirrored workflow diagrams**
- Add an English Mermaid diagram to `README.md`.
- Add a Chinese Mermaid diagram to the Chinese mirror doc.

**Step 5: Verify link integrity inside both README files**
- Ensure English README points only to English docs.
- Ensure Chinese README points only to Chinese docs.

### Task 2: Split governance and deployment docs into mirrored language files

**Files:**
- Modify: `CONTRIBUTING.md`
- Create: `CONTRIBUTING_ZH.md`
- Modify: `SECURITY.md`
- Create: `SECURITY_ZH.md`
- Modify: `CODE_OF_CONDUCT.md`
- Create: `CODE_OF_CONDUCT_ZH.md`
- Modify: `docs/open-source-launch.md`
- Create: `docs/open-source-launch_ZH.md`
- Modify: `docs/deployment/docker-self-hosted.md`
- Create: `docs/deployment/docker-self-hosted_ZH.md`

**Step 1: Remove mixed-language bodies from default files**
- Make the standard file names English-only.

**Step 2: Create Chinese mirror files**
- Move the Chinese content into `_ZH` mirror files.
- Add language toggles at the top of each pair.

**Step 3: Normalize cross-links**
- English docs link to English docs.
- Chinese docs link to Chinese docs.

### Task 3: Clean repository-level public entry points

**Files:**
- Modify: `.github/ISSUE_TEMPLATE/config.yml`
- Modify: `.github/ISSUE_TEMPLATE/bug_report.yml`
- Modify: `.github/ISSUE_TEMPLATE/feature_request.yml`
- Modify: `README.md`
- Modify: `README_ZH.md`

**Step 1: Point GitHub contact links at the English default docs**
- Keep repository-level defaults aligned with the public landing language.

**Step 2: Keep issue templates readable and concise**
- Remove unnecessary bilingual duplication where it weakens scannability.
- Preserve the product constraints that matter.

### Task 4: Verify rendered docs and repository state

**Files:**
- Review only

**Step 1: Search for stale links and mixed-language leftovers**
- Use `rg` for old filenames and cross-language references.

**Step 2: Review git diff for readability**
- Make sure the repo presents a coherent English-first public face plus a complete Chinese mirror.

**Step 3: Run a lightweight verification command if needed**
- Because this is docs-only, use targeted checks rather than a full runtime rebuild unless a file outside docs changed.

**Step 4: Prepare a concise change summary**
- Call out the default language assumption and what remains intentionally GitHub-native.
