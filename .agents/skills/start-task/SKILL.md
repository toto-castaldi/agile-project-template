---
name: start-task
description: Start a backlog item (US, TEC, SPIKE or BUG) - check dependencies, create its dedicated branch from main, set it In Progress in the backlog. Use when the user asks to start, begin, pick up or resume an item, or to work on the next ready item.
---

# Start an item

Rules: `docs/PROCESS.md` §4, §6, §7 and `AGENTS.md`. `backlog` is `python3 .agents/tools/backlog.py`. The user's arguments, if any, identify the item (e.g. `US-004`); without arguments, propose the first item of `backlog ready` and ask for confirmation.

## 1. Checks

1. Run `backlog show <ID>`.
2. The item exists and is `Todo`, or `Blocked` and the user wants to resume it. If it is already `In Progress`, switch to its branch instead of creating a new one.
3. All dependencies are `Done`. If not, stop and report which are missing; continue only if the user explicitly asks, passing the reason to `backlog start --override-dependencies`.
4. The working tree is clean. If not, stop and ask how to handle the pending changes.
5. If `AGENTS.md` still shows "Template not initialized", only `TEC-001` can be started: use the `kickoff` skill.
6. Shared claims (`docs/PROCESS.md` §6.4) are on only if `AGENTS.md` §10 sets `Shared claims` to `on`. If they are on and `git remote` lists no `origin`, report that claims cannot be shared and continue with them off.
7. With shared claims on and a `Todo` item: run `git fetch --prune origin` (if it fails, report and ask before continuing), then look for an existing branch of the same ID:

   ```bash
   git branch -a --list '*/<ID>-*' --format='%(refname:short) %(committerdate:iso) %(authorname)'
   ```

   If any branch matches, stop and report each branch with the date and author of its last commit: the item is probably taken in another clone. Continue only if the user explicitly asks, by switching to that branch (`git switch <branch>` without the `origin/` prefix) instead of creating a new one.

## 2. Branch

Branch name: `<prefix><ID>-<short-slug>` with prefix `us/`, `task/`, `spike/` or `fix/` and a lowercase kebab-case slug of the title.

```bash
git switch main
git pull --ff-only      # skip if there is no remote/upstream yet
git switch -c <branch>
```

For a `Blocked` item being resumed, switch to its existing branch and rebase or merge `main` only if needed and agreed.

## 3. Update the backlog

1. On the item branch run `backlog start <ID>` (it takes the branch name from git), or `backlog resume <ID>` for a `Blocked` item.
2. Commit the change: `chore(<ID>): <"start item" in the project language>`.
3. With shared claims on, push the item branch at once: `git push -u origin <branch>`. If the push fails, keep the commit, report that the claim is not shared and stop: do not prepare or implement the item until the user decides.

## 4. Prepare the work

1. Read the requirements and design sections referenced by the item and, if assigned, its module entry in `docs/TECHNICAL-DESIGN.md` §3.
2. Summarize to the user: goal, acceptance criteria, planned approach, open questions.
3. If the user asked to implement the item, proceed; otherwise stop here.

During the work, if the item gets blocked, run `backlog block <ID> --reason …` and commit in the item branch. With shared claims on, push the item branch after that commit, as after the start and resume commits.
