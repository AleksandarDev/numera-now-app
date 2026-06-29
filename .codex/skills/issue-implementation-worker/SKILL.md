---
name: issue-implementation-worker
description: Implement one feature-agnostic GitHub issue through a tested pull request. Use when Codex is assigned a specific issue or PR-sized slice and must inspect the codebase, create or use a branch, make scoped code changes, run verification, open/update the PR, address comments, and ensure CI is passing.
---

# Issue Implementation Worker

## Purpose

Implement exactly one issue-sized change with production-quality scope control. The issue is the contract; the codebase determines the implementation shape.

## Intake

Before editing, resolve:

- Repository and issue number
- Base branch and working branch
- Acceptance criteria and explicit non-goals
- Dependencies or blocked-by issues
- Expected verification commands
- Existing local changes that must be preserved

If the issue is blocked, do not implement around the blocker. Report the blocker and wait for the coordinator or user to advance it.

## Implementation Workflow

1. Inspect before changing:
   - Read the relevant routes, schema, components, tests, docs, and existing helpers.
   - Prefer repo patterns over new abstractions.
   - Identify the smallest coherent change that satisfies the issue.

2. Edit deliberately:
   - Keep the write set scoped to the issue.
   - Avoid unrelated refactors and metadata churn.
   - Preserve user or coworker changes in the working tree.
   - Add comments only for non-obvious logic.

3. Verify locally:
   - Run the narrowest meaningful tests first.
   - Run broader checks when shared behavior, schema, public APIs, or user flows change.
   - If a check cannot run, record why and what risk remains.

4. Prepare the PR:
   - Commit with a concise message tied to the issue.
   - Push the branch.
   - Open a PR linked to the issue.
   - Include summary, verification, risks, and rollout notes.
   - Enable auto-merge when requested and available.

5. Address review and CI:
   - Fetch PR comments and review threads.
   - Patch actionable feedback on the same branch.
   - Inspect CI logs for failures and fix deterministic failures.
   - Rerun failed jobs only when the evidence points to flakes or infrastructure.
   - Leave the PR in a state where CI passes and comments are resolved or clearly answered.

## PR Body Template

```markdown
## Summary

- TBD

## Verification

- TBD

## Risk

- TBD

Closes #<issue>
```

Use `Closes` only when the PR fully satisfies the issue. Use `Refs` when the PR is partial or preparatory.

## Completion Criteria

The issue is done only when:

- The PR implements all acceptance criteria.
- Local verification has run or a gap is explicitly documented.
- CI is passing.
- Actionable review comments are addressed.
- The PR is merged or auto-merge is enabled and waiting only for required checks/reviews.
