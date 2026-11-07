---
name: merge-task
description: Merge a completed backlog item branch (or a backlog grooming branch) into main with --no-ff, push, and delete the merged branch. Run only on explicit user request.
disable-model-invocation: true
---

# Merge an item into main

Rules: `docs/PROCESS.md` §6.3. Merging is never automatic: run this only because the user explicitly asked. The user's arguments, if any, identify the item or branch; otherwise use the current branch.

## 1. Checks

1. Identify the branch and the item. If the branch exists only on `origin` (for example when another clone pushed it, `docs/PROCESS.md` §6.4–§6.5), run `git fetch --prune origin` and use `git switch <branch>` to create the local tracking branch. For item branches, the item must be `Done` in `BACKLOG.md` **on that branch**. If not, stop and suggest `finish-task`.
2. The working tree is clean.
3. Show the user what will be merged (`git log --oneline main..<branch>`) if they have not seen it yet.
4. Check the item's records on the branch (`Outcome`, dates, `STATUS.md` consistency). If something is wrong, stop before merging: report it and fix it with a commit on the item branch (with parallel work, ask its worker), never inside the merge commit.

## 2. Merge

```bash
git switch main
git pull --ff-only                 # skip if there is no remote/upstream yet
git merge --no-ff <branch> -m "merge(<ID>): <item title>"
```

For a grooming branch `backlog/<slug>`, use `merge(<ID>): <short description>` with the main item ID touched.

Conflicts:

- In `BACKLOG.md`, keep both sides' changes: each item keeps its own most recent state.
- In `STATUS.md`, never resolve the conflict by hand or pick a side: regenerate the whole file from the merged `BACKLOG.md` (counts, in progress, blocked, recently completed, next ready items), as required by `docs/PROCESS.md` §6.3. This holds with or without parallel work.
- In `CHANGELOG.md`, keep all lines from both sides under `[Unreleased]`.
- Change nothing beyond the conflict resolution.
- For code conflicts, resolve them only if the resolution is obvious; otherwise abort the merge (`git merge --abort`) and ask the user.

## 3. Verify and publish

1. Run the closing quality gate from `AGENTS.md` §6 on `main` before push: lint, typecheck, build and in-memory unit tests only. Integration and end-to-end suites are separate evidence gathered during the item when needed, not part of the merge or push gate. If the gate fails, do not push: report and ask the user how to proceed.
2. `git push origin main` (if a remote exists).

## 4. Clean up

1. Verify the branch is merged: `git branch --merged main` lists it.
2. Delete it locally (`git branch -d <branch>`) and remotely if it exists (`git push origin --delete <branch>`).
3. Never delete a branch that is not merged.

Report: merge commit, push result, deleted branches, next ready items from `STATUS.md`.
