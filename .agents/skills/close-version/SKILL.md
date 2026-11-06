---
name: close-version
description: Close the open version - verify every item is Done and release acceptance is met, finalize CHANGELOG, BACKLOG and STATUS in a release branch, merge into main, create the annotated vX.Y.Z tag and push. Run only on explicit user request.
disable-model-invocation: true
---

# Close a version

Rules: `docs/PROCESS.md` §4.1, §9. Run only because the user explicitly asked. The user's arguments, if any, name the version; otherwise use the open version in `STATUS.md`.

## 1. Checks

1. `main` is up to date (`git switch main && git pull --ff-only`) and the working tree is clean.
2. Every item assigned to the version is `Done` in `BACKLOG.md`. List any that are not and stop.
3. No item branch of this version is still unmerged (`git branch -a --no-merged main`). Report any and stop.
4. Walk through the release acceptance criteria in `docs/REQUIREMENTS.md` §7: for each, give evidence. Stop if any is not met, unless the user explicitly decides otherwise (record that decision in `STATUS.md` notes).
5. Run the closing quality gate from `AGENTS.md` §6 on `main` (lint, typecheck, build and in-memory unit tests only), and separately run all integration suites listed there. Verify external-service end-to-end evidence separately as required by release acceptance. Stop if any required check fails.

## 2. Release branch

```bash
git switch -c release/vX.Y.Z
```

1. `CHANGELOG.md`: rename `[Unreleased]` to `[X.Y.Z] - YYYY-MM-DD`, remove empty subsections, add a new empty `[Unreleased]` section on top.
2. `BACKLOG.md`: version `State: Closed (YYYY-MM-DD)`. Ask the user whether to open the next version now: if yes, add its section with `State: Open` and its goal. Existing fully defined items may be moved; do not create new items on the release branch. Promote unassigned ideas to items later on `main` using `add-item`.
3. `docs/REQUIREMENTS.md` / `docs/TECHNICAL-DESIGN.md`: update the target version only if the next version is opened.
4. `STATUS.md`: add the version to `Closed versions` with date and tag, set the current version (or "none open"), recompute counts and next ready items.
5. Commit: `release(vX.Y.Z): <short description in the project language>`.

## 3. Merge, tag, publish

```bash
git switch main
git merge --no-ff release/vX.Y.Z -m "merge(vX.Y.Z): release"
git tag -a vX.Y.Z -m "<version goal in the project language>"
git push origin main
git push origin vX.Y.Z
git branch -d release/vX.Y.Z
```

Skip pushes if there is no remote. Report: tag, merge commit, CHANGELOG section, next version state. If the user wants to turn unassigned ideas into items, do so afterward on clean `main` using `add-item`, one commit per item.
