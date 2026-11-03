---
name: start-task
description: Start a backlog item (US, TEC, SPIKE or BUG) - check dependencies, create its dedicated branch from main, set it In Progress in BACKLOG.md and STATUS.md. Use when the user asks to start, begin, pick up or resume an item, or to work on the next ready item.
---

# Start an item

Rules: `docs/PROCESS.md` §4, §6, §7 and `AGENTS.md`. The user's arguments, if any, identify the item (e.g. `US-004`); without arguments, propose the highest-priority item among the next ready items in `STATUS.md` and ask for confirmation.

## 1. Checks

1. Read `STATUS.md` and the item in `BACKLOG.md`.
2. The item exists and is `Todo`, or `Blocked` and the user wants to resume it. If it is already `In Progress`, switch to its branch instead of creating a new one.
3. All dependencies are `Done`. If not, stop and report which are missing; continue only if the user explicitly asks, and record that in the item.
4. The working tree is clean. If not, stop and ask how to handle the pending changes.
5. If `AGENTS.md` still shows "Template not initialized", only `TEC-001` can be started: use the `kickoff` skill.

## 2. Branch

Branch name: `<prefix><ID>-<short-slug>` with prefix `us/`, `task/`, `spike/` or `fix/` and a lowercase kebab-case slug of the title.

```bash
git switch main
git pull --ff-only      # skip if there is no remote/upstream yet
git switch -c <branch>
```

For a `Blocked` item being resumed, switch to its existing branch and rebase or merge `main` only if needed and agreed.

## 3. Update backlog and status

1. In `BACKLOG.md`: `Status: In Progress`, add the `Branch` field; remove `Blocked by` when resuming.
2. In `STATUS.md`: last update date, counts, `In progress` table (item, epic, title, branch), remove the item from `Next ready items` / `Blocked`, update the version phase if it changed.
3. Check that counts in `STATUS.md` match `BACKLOG.md`.
4. Commit both files together: `chore(<ID>): <"start item" in the project language>`.

## 4. Prepare the work

1. Read the requirements and design sections referenced by the item.
2. Summarize to the user: goal, acceptance criteria, planned approach, open questions.
3. If the user asked to implement the item, proceed; otherwise stop here.

During the work, if the item gets blocked, set `Blocked` with `Blocked by` in `BACKLOG.md`, update `STATUS.md` and commit in the item branch.
