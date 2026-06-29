---
name: issue-pr-coordinator
description: Coordinate a feature-agnostic implementation effort from GitHub issues into one pull request per issue, using Codex threads or subagents when explicitly requested or useful. Use when Codex needs to plan dependency order, create or steer worker threads, track PR comments, enable auto-merge, monitor CI, keep issue/PR state aligned, and verify that all related PRs are merged.
---

# Issue PR Coordinator

## Purpose

Drive a multi-issue delivery effort without encoding feature-specific architecture. Treat each issue as the source of truth, preserve its acceptance criteria, and coordinate one reviewed, passing, merged PR per issue.

## Operating Rules

- Resolve the repository, umbrella issue, subissues, dependency graph, base branch, and merge policy before starting implementation.
- Keep the plan issue-agnostic: sequence work by dependencies, risk, and blast radius, not by assumed domain details.
- Use separate branches and worktrees for parallel implementation when write scopes do not overlap.
- Start Codex threads only when the user asked for background threads or persistent handoff. Use subagents only for bounded work that can run in parallel.
- Never merge or mark complete until tests, CI, PR comments, and requested verification are handled.
- Keep issue bodies, PR bodies, branch names, and final summaries linked by issue number.

## Coordination Workflow

1. Build the delivery map:
   - List the umbrella issue, subissues, dependency relationships, and open questions.
   - Mark each issue as blocked, unblocked, in progress, in review, merged, or needs follow-up.
   - Identify the smallest first PR that improves future delivery, such as shared tooling or skills, when requested.

2. Prepare workers:
   - Give each worker exactly one issue number and one branch.
   - Include acceptance criteria, dependency constraints, expected verification, and files/modules likely in scope.
   - Tell workers they are not alone in the codebase and must not revert unrelated changes.
   - Ask workers to return changed files, tests run, PR link, unresolved risks, and any follow-up needed.

3. Open one PR per issue:
   - Name branches with the repo convention, usually `feat/<short-issue-slug>`.
   - Use a PR body with: linked issue, summary, verification, risk, and rollout notes.
   - Link the issue with `Closes #<issue>` only when the PR fully satisfies that issue.
   - Enable auto-merge after the PR exists if the repository supports it and the user requested it.

4. Monitor feedback:
   - Check PR conversation comments, inline review threads, requested changes, and CI status.
   - Treat actionable comments as work items. Patch the PR branch, rerun tests, and respond or resolve when addressed.
   - Inspect CI logs for deterministic failures. Rerun once only when evidence suggests flakes or infrastructure failures.

5. Advance dependencies:
   - Start dependent issues only after their blockers are merged or after confirming the dependency is not actually required.
   - Rebase or update dependent branches after blockers merge when shared files or contracts changed.
   - Keep the umbrella issue updated with merged PRs and remaining blockers when the platform does not provide native dependencies.

6. Verify completion:
   - Confirm every issue PR is merged.
   - Confirm CI is passing on merged commits or the target branch.
   - Confirm PR comments and review threads are resolved or intentionally documented.
   - Confirm user-facing or operational verification was performed for the complete flow.

## PR Tracking Checklist

For each issue, track:

- Issue number and URL
- Branch name
- PR number and URL
- Blocked-by issues
- Local tests run
- CI state
- Open PR comments or review threads
- Merge state
- Follow-up issues

## Escalation

Stop and ask only when a decision would change product behavior, security posture, data retention, billing, destructive migration strategy, or merge policy. Otherwise, make conservative implementation choices and keep delivery moving.
