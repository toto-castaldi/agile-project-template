---
name: merge-task
description: Merge a completed backlog item branch (or a backlog grooming branch) into main with --no-ff, push, and delete the merged branch. Run only on explicit user request.
disable-model-invocation: true
---

# Merge an item into main

Rules: `docs/PROCESS.md` §6.3. Merging is never automatic: run this only because the user explicitly asked. The user's arguments, if any, identify the item or branch; otherwise use the current branch.

## 1. Checks

1. Identify the branch and the item. For item branches, the item must be `Done` in `BACKLOG.md` **on that branch**. If not, stop and suggest `finish-task`.
2. The working tree is clean.
3. Show the user what will be merged (`git log --oneline main..<branch>`) if they have not seen it yet.

## 2. Merge

```bash
git switch main
git pull --ff-only                 # skip if there is no remote/upstream yet
git merge --no-ff <branch> -m "merge(<ID>): <item title>"
```

For a grooming branch `backlog/<slug>`, use `merge(<ID>): <short description>` with the main item ID touched.

Conflicts:

- In `BACKLOG.md`, keep both sides' changes: each item keeps its own most recent state.
- In `STATUS.md`, do not pick a side: recompute it from the merged `BACKLOG.md` (counts, in progress, blocked, recently completed, next ready items).
- In `CHANGELOG.md`, keep all lines from both sides under `[Unreleased]`.
- For code conflicts, resolve them only if the resolution is obvious; otherwise abort the merge (`git merge --abort`) and ask the user.

## 3. Verify and publish

1. Run the quality gate from `AGENTS.md` §6 on `main`. If it fails, do not push: report and ask the user how to proceed.
2. `git push origin main` (if a remote exists).

## 4. Clean up

1. Verify the branch is merged: `git branch --merged main` lists it.
2. Delete it locally (`git branch -d <branch>`) and remotely if it exists (`git push origin --delete <branch>`).
3. Never delete a branch that is not merged.

Report: merge commit, push result, deleted branches, next ready items from `STATUS.md`.
