# Dependabot Auto-Rebase Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Automatically rebase every open Dependabot PR after `main` changes while preserving all branch-protection checks.

**Architecture:** Keep Dependabot's native rebase strategy explicit and run it daily. Add a narrowly-permissioned GitHub Actions workflow that reacts to pushes on `main` by posting Dependabot's supported rebase command only to open Dependabot-authored PRs.

**Tech Stack:** Dependabot v2 configuration, GitHub Actions YAML, GitHub CLI.

---

### Task 1: Configure native Dependabot rebasing

**Files:**
- Modify: `.github/dependabot.yml`

**Step 1:** Change all three schedules from `weekly` to `daily`.

**Step 2:** Add `rebase-strategy: auto` to all three update entries.

**Step 3:** Parse the YAML and assert all entries have the expected values.

### Task 2: Rebase after main changes

**Files:**
- Create: `.github/workflows/dependabot-rebase.yml`

**Step 1:** Add `push` on `main` and `workflow_dispatch` triggers.

**Step 2:** Grant only `contents: read`, `pull-requests: read`, and the `issues: write` permission required to post PR conversation comments.

**Step 3:** Query open PRs authored by `app/dependabot` and post `@dependabot rebase` to each one.

**Step 4:** Add concurrency protection and verify the workflow YAML and shell syntax.

### Task 3: Deliver through repository protections

**Files:**
- Include: `.github/dependabot.yml`
- Include: `.github/workflows/dependabot-rebase.yml`
- Include: `docs/plans/2026-09-17-dependabot-auto-rebase-design.md`
- Include: `docs/plans/2026-09-17-dependabot-auto-rebase-plan.md`

**Step 1:** Run whitespace, YAML, and workflow validation.

**Step 2:** Commit on `codex/dependabot-auto-rebase`.

**Step 3:** Push the branch and open a PR against `main`; do not bypass branch protection.
