---
name: finish-task
description: Complete the backlog item of the current branch - verify acceptance criteria and the Definition of Done, run the quality gate, update docs and the backlog with the changelog entry, and commit in the item branch without merging. Use when an item's implementation is finished or the user asks to close/complete an item.
---

# Finish an item

Rules: `docs/PROCESS.md` §4.2, §6 and the quality gate and DoD additions in `AGENTS.md`. The item is the one of the current branch, or the one given in the user's arguments. `backlog` is `python3 .agents/tools/backlog.py`.

## 1. Checks

1. You are on the item's dedicated branch, not on `main`.
2. The item is `In Progress` (`backlog show <ID>`).

## 2. Verify

1. For every acceptance criterion, collect concrete evidence (test names, command output, manual verification performed). List any criterion that is not satisfied.
2. Run the closing gate of `AGENTS.md` §6 (`docs/PROCESS.md` §6), after its preparation command if needed, and the integration or end-to-end suites needed to prove the criteria or the DoD additions. Report failures with their output; do not hide or skip required evidence.
3. Walk through every point of the Definition of Done (`docs/PROCESS.md` §6 and `AGENTS.md` §7). For spikes, the report in `docs/spikes/` answers every question and the index is updated.

If anything is not satisfied, the item is **not** `Done`: report what is missing and either keep working, or with the user's agreement mark it `Blocked` (with shared claims on, push the item branch after that commit, as in step 4) or split it into a new item. To add that item, preserve the current work and ask the user to return to a clean `main` before using `add-item`.

## 3. Update records

1. `backlog done <ID> --outcome "<what was delivered and verified>"`: it sets the state and the closing date. For a user-visible change add `--changelog "<Added|Changed|Fixed|Removed>: <change>"`: one line as the user sees it, in the project language, about 120 characters at most, without the item ID (the CLI adds it). Details belong in the outcome. Do not edit `CHANGELOG.md`: `close-version` generates its section from these entries.
2. `backlog check`: fix and report any inconsistency.

## 4. Commit

Commit the remaining work and the record updates in the item branch with a Conventional Commit in the project language, e.g. `feat(US-004): <description>`. Make sure the working tree is clean afterwards.

With shared claims on (`docs/PROCESS-PARALLEL.md` §1: `AGENTS.md` §10 sets `Shared claims` to `on` and an `origin` remote exists), push the item branch: `git push -u origin <branch>`. If the push fails, keep the commit and report that the `Done` state is not shared.

Do **not** merge or push to `main`. Report to the user: summary, evidence per acceptance criterion, quality gate result, branch name, the push result when shared claims are on, and that `merge-task` can be run on their request.
