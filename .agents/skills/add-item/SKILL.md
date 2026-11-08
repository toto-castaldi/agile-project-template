---
name: add-item
description: Add one new User Story, Task, Spike or Bug to the backlog on main, recording the requirement first when behavior changes, assigning epic, version, priority, dependencies and and acceptance criteria. Use when a request needs a new backlog item.
---

# Add an item to the backlog

Rules: `docs/PROCESS.md` §3, §4, §5, §6.1. The user's arguments describe the new work. `backlog` is `python3 .agents/tools/backlog.py`.

## 1. Understand

Before starting, verify that the current branch is `main` and the working tree is clean. If either check fails, stop and ask the user to resolve it; do not switch branches, stash or discard changes automatically. If `main` has an upstream, run `git pull --ff-only` before making changes; stop if it fails.

1. Run `backlog status` and `backlog list --limit 0`; read the relevant parts of `docs/REQUIREMENTS.md` and the module catalog, if any, in `docs/TECHNICAL-DESIGN.md` §3.
2. Classify the work: `US` (value for an actor), `TEC` (technical), `SPIKE` (questions to answer), `BUG` (behavior contradicting requirements or acceptance criteria).
3. Check for duplicates or overlaps with existing items and requirements; report them.
4. Ask the user what is missing (use a structured question tool if available), in particular:
   - target version: the open version (this is a scope change: confirm explicitly), a future version (`backlog version add --planned` if it does not exist), or the unassigned ideas;
   - epic: an existing one or a new one (title, scope; create it with `backlog epic add`);
   - optional module: an existing module from `docs/TECHNICAL-DESIGN.md` §3, a new agreed module, or none for unassigned/cross-cutting work;
   - priority and dependencies;
   - for bugs: version where found, steps to reproduce, expected and actual behavior.

## 2. Write

Add one item on `main`; do not create a branch. If the request arose on an item branch, stop and ask the user to return to a clean `main` before starting. Do not implement the item here.

1. **Requirements first**: if behavior or scope changes, add or update the requirement in `docs/REQUIREMENTS.md` with a new stable ID (never reuse IDs; mark removed ones as `Withdrawn`). Update the in/out of scope lists if needed.
2. **Design**: if a new module was agreed, record its ID, name, responsibility and known location or boundaries in `docs/TECHNICAL-DESIGN.md` §3. If the item opens a design decision, add it to `Open decisions`.
3. **Backlog**: `backlog add --type <US|TEC|SPIKE|BUG> --title … --version … --epic … --priority … --criterion … [--dependencies …] [--requirements …] [--design-references …] [--module …] [--description …]`. It assigns the next free ID and refuses invalid items, so requirements and modules must already be recorded. Repeat `--criterion` for each verifiable criterion. Use `--module` only when a module was agreed. For bugs add `--found-in`, `--steps-to-reproduce`, `--expected`, `--actual` and a regression-test criterion. For an unassigned idea use `backlog ideas --add` instead: one line, no ID.
4. Run `backlog check`; fix any inconsistency before committing.

## 3. Commit

After checking consistency, `git diff --check` and `git diff --cached --check`, create exactly one commit on `main` containing the new item and all related requirements and design updates, without unrelated changes. Use the project language, e.g. `docs(US-014): <"add" + title>`. Report the new item and commit to the user. No merge is needed; do not push unless the user explicitly requests it.
