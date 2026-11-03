---
name: add-item
description: Add a new User Story, Task, Spike or Bug to the backlog, recording the requirement first when behavior changes, assigning epic, version, priority, dependencies and acceptance criteria, and updating STATUS.md. Use when the user asks for a new feature, reports a bug, proposes a spike, or wants to change requirements or version scope.
---

# Add an item to the backlog

Rules: `docs/PROCESS.md` §3, §4, §5, §6.1. The user's arguments describe the new work.

## 1. Understand

1. Read `STATUS.md`, `BACKLOG.md` and the relevant parts of `docs/REQUIREMENTS.md`.
2. Classify the work: `US` (value for an actor), `TEC` (technical), `SPIKE` (questions to answer), `BUG` (behavior contradicting requirements or acceptance criteria).
3. Check for duplicates or overlaps with existing items and requirements; report them.
4. Ask the user what is missing (use a structured question tool if available), in particular:
   - target version: the open version (this is a scope change: confirm explicitly), a future version, or the `Unassigned backlog`;
   - epic: an existing one or a new one (ID, title, scope);
   - priority and dependencies;
   - for bugs: version where found, steps to reproduce, expected and actual behavior.

## 2. Branch

- If the current branch is an item branch and the new item is strictly needed by it, add it there.
- Otherwise create a grooming branch from up-to-date `main`: `backlog/<short-slug>`.

## 3. Write

1. **Requirements first**: if behavior or scope changes, add or update the requirement in `docs/REQUIREMENTS.md` with a new stable ID (never reuse IDs; mark removed ones as `Withdrawn`). Update the in/out of scope lists if needed.
2. **Backlog**: add the item under its epic in the version section with the next free ID of its type and all mandatory fields (`docs/PROCESS.md` §4.4), verifiable acceptance criteria, requirements or design references. For bugs include `Found in`, `Steps to reproduce`, `Expected`, `Actual` and a regression-test criterion. Update `Dependencies and suggested order` if relevant. Items for the `Unassigned backlog` may be a single line without full fields.
3. **Design**: if the item opens a design decision, add it to `Open decisions` in `docs/TECHNICAL-DESIGN.md`.
4. **Status**: update `STATUS.md` (date, progress, counts, next ready items, phase if the scope of the open version changed).
5. Check consistency between `STATUS.md` and `BACKLOG.md`.

## 4. Commit

Commit in the project language, e.g. `docs(US-014): <"add" + title>`. Report the new item to the user. If a grooming branch was used, remind them it can be merged with `merge-task`; do not merge it automatically.
