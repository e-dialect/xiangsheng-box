# Dependabot Auto-Rebase Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Keep open Dependabot PRs automatically rebased without bypassing branch-protection checks or storing a maintainer credential.

**Architecture:** Keep Dependabot's native rebase strategy explicit and run it daily. Do not post Dependabot commands from GitHub Actions because Dependabot does not authorize GitHub App identities for comment commands. Use a maintainer command only for one-time urgent refreshes.

**Tech Stack:** Dependabot v2 configuration, GitHub CLI.

---

### Task 1: Configure native Dependabot rebasing

**Files:**
- Modify: `.github/dependabot.yml`

**Step 1:** Change all three schedules from `weekly` to `daily`.

**Step 2:** Add `rebase-strategy: auto` to all three update entries.

**Step 3:** Parse the YAML and assert all entries have the expected values.

### Task 2: Avoid unsupported bot commands

**Files:**
- Do not include: `.github/workflows/dependabot-rebase.yml`

**Step 1:** Remove the workflow that posts `@dependabot rebase` as `github-actions[bot]`.

**Step 2:** Document that GitHub App identities are rejected by Dependabot comment-command authorization even when they have write permissions.

**Step 3:** Keep urgent, one-time rebases as an explicit maintainer action instead of storing a long-lived PAT in Actions secrets.

### Task 3: Deliver through repository protections

**Files:**
- Include: `.github/dependabot.yml`
- Remove: `.github/workflows/dependabot-rebase.yml`
- Include: `docs/plans/2026-09-17-dependabot-auto-rebase-design.md`
- Include: `docs/plans/2026-09-17-dependabot-auto-rebase-plan.md`

**Step 1:** Run whitespace and YAML validation, and assert the unsupported workflow is absent.

**Step 2:** Commit on `codex/remove-unsupported-dependabot-workflow`.

**Step 3:** Push the branch and open a PR against `main`; do not bypass branch protection.
