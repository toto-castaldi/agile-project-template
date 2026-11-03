---
name: finish-task
description: Complete the backlog item of the current branch - verify acceptance criteria and the Definition of Done, run the quality gate, update docs, CHANGELOG, BACKLOG.md and STATUS.md, and commit in the item branch without merging. Use when an item's implementation is finished or the user asks to close/complete an item.
---

# Finish an item

Rules: `docs/PROCESS.md` §7, §8 and the quality gate and DoD additions in `AGENTS.md`. The item is the one of the current branch, or the one given in the user's arguments.

## 1. Checks

1. You are on the item's dedicated branch, not on `main`.
2. The item is `In Progress` in `BACKLOG.md`.

## 2. Verify

1. For every acceptance criterion, collect concrete evidence (test names, command output, manual verification performed). List any criterion that is not satisfied.
2. Run the full quality gate from `AGENTS.md` §6. Report failures with their output; do not hide or skip them.
3. Walk through the Definition of Done (`docs/PROCESS.md` §8 and `AGENTS.md` §7):
   - tests at the right level, regression test for bugs;
   - no secrets in files, commits or logs;
   - requirements, technical design, ADRs, configuration examples, README updated where needed;
   - for spikes: report in `docs/spikes/` answers every question, index updated.

If anything is not satisfied, the item is **not** `Done`: report what is missing and either keep working, or with the user's agreement mark it `Blocked` or split it into a new item (via `add-item`).

## 3. Update records

1. `CHANGELOG.md`: for user-visible changes, add a line under `[Unreleased]` in the right subsection (`Added`, `Changed`, `Fixed`, `Removed`), in the project language, ending with the item ID.
2. `BACKLOG.md`: `Status: Done`, `Outcome` with what was delivered and verified and the closing date.
3. `STATUS.md`: last update date, progress and counts, remove from `In progress`, add on top of `Recently completed` (keep the last 10), recompute `Next ready items` (Todo items whose dependencies are all `Done`, by priority), update phase, keep notes short.
4. Check that `STATUS.md` is consistent with `BACKLOG.md` (counts, states, next ready items). Fix and report any inconsistency.

## 4. Commit

Commit the remaining work and the record updates in the item branch with a Conventional Commit in the project language, e.g. `feat(US-004): <description>`. Make sure the working tree is clean afterwards.

Do **not** merge or push to `main`. Report to the user: summary, evidence per acceptance criterion, quality gate result, branch name, and that `merge-task` can be run on their request.
