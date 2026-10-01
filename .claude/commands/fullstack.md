---
description: Build a feature with backend-dev, frontend-dev and qa-engineer working in parallel and coordinating through a shared contract
argument-hint: <feature description>
---

Build this feature using the `backend-dev`, `frontend-dev` and `qa-engineer` subagents in parallel:

$ARGUMENTS

Steps:

1. Pick a short kebab-case feature slug. The contract file will be `.claude/handoff/<slug>.md`. Backend-dev creates it; don't create it yourself.
2. Read just enough of the code to write a precise brief. Include:
   - the user-facing goal
   - which roles can use it
   - the affected module and its existing files
   - any inventory or unit rules that apply
3. In a **single message**, launch all three agents with `run_in_background: true`:
   - `subagent_type: backend-dev`
   - `subagent_type: frontend-dev`
   - `subagent_type: qa-engineer`
   Give each the same brief, the slug, the contract path, and the names of the other two agents.
   Do not use worktree isolation: they share one working tree and stay out of each other's directories.
4. While they run:
   - If an agent's report contains a message it couldn't deliver to another agent, relay it with `SendMessage`.
   - If backend-dev or frontend-dev finishes while a `QA-<n>` finding assigned to it is still open, resume it with `SendMessage` to fix that finding.
   - Don't edit their files yourself.
5. When all three have finished:
   - Read the contract.
   - Run `php artisan test` and `npm run build`.
   - Report to me: what was built, the files changed, test and build results, acceptance-criteria coverage, and every QA finding with its final state.
