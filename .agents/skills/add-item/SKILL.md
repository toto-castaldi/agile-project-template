---
name: add-item
description: Add one new User Story, Task, Spike or Bug to the backlog on main, recording the requirement first when behavior changes, assigning epic, version, priority, dependencies and acceptance criteria, and updating STATUS.md. Use when a request needs a new backlog item.
---

# Add an item to the backlog

Rules: `docs/PROCESS.md` §3, §4, §5, §6.1. The user's arguments describe the new work.

## 1. Understand

Before starting, verify that the current branch is `main` and the working tree is clean. If either check fails, stop and ask the user to resolve it; do not switch branches, stash or discard changes automatically. If `main` has an upstream, run `git pull --ff-only` before making changes; stop if it fails.

1. Read `STATUS.md`, `BACKLOG.md`, the relevant parts of `docs/REQUIREMENTS.md` and the module catalog, if any, in `docs/TECHNICAL-DESIGN.md` §3.
2. Classify the work: `US` (value for an actor), `TEC` (technical), `SPIKE` (questions to answer), `BUG` (behavior contradicting requirements or acceptance criteria).
3. Check for duplicates or overlaps with existing items and requirements; report them.
4. Ask the user what is missing (use a structured question tool if available), in particular:
   - target version: the open version (this is a scope change: confirm explicitly), a future version, or the `Unassigned backlog`;
   - epic: an existing one or a new one (ID, title, scope);
   - optional module: an existing module from `docs/TECHNICAL-DESIGN.md` §3, a new agreed module, or none for unassigned/cross-cutting work;
   - priority and dependencies;
   - for bugs: version where found, steps to reproduce, expected and actual behavior.

## 2. Write

Add one item on `main`; do not create a branch. If the request arose on an item branch, stop and ask the user to return to a clean `main` before starting. Do not implement the item here.

1. **Requirements first**: if behavior or scope changes, add or update the requirement in `docs/REQUIREMENTS.md` with a new stable ID (never reuse IDs; mark removed ones as `Withdrawn`). Update the in/out of scope lists if needed.
2. **Backlog**: add the item under its epic in the version section with the next free ID of its type and all mandatory fields (`docs/PROCESS.md` §4.4), verifiable acceptance criteria, requirements or design references. Add the optional `Module` field only when a module was agreed; its ID and name must match `docs/TECHNICAL-DESIGN.md` §3. For bugs include `Found in`, `Steps to reproduce`, `Expected`, `Actual` and a regression-test criterion. Update `Dependencies and suggested order` if relevant. Items for the `Unassigned backlog` may be a single line without full fields, but still need a unique stable ID; retain any agreed module association on that line.
3. **Design**: if a new module was agreed, record its ID, name, responsibility and known location or boundaries in `docs/TECHNICAL-DESIGN.md` §3 in the same commit. If the item opens a design decision, add it to `Open decisions`.
4. **Status**: update `STATUS.md` (date from `date +%F`, progress, counts, next ready items, phase if the scope of the open version changed).
5. Count the item states mechanically and check them against `STATUS.md` (`docs/PROCESS.md` §7); fix any inconsistency before committing.

## 3. Commit

After checking consistency, `git diff --check` and `git diff --cached --check`, create exactly one commit on `main` containing the new item and all related requirements, design and status updates, without unrelated changes. Use the project language, e.g. `docs(US-014): <"add" + title>`. Report the new item and commit to the user. No merge is needed; do not push unless the user explicitly requests it.
