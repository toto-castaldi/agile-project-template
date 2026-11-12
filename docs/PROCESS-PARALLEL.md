# Parallel work

Optional rules, read only when `AGENTS.md` §10 turns on `Shared claims` or `Parallel work`, and by the `orchestrate` skill. They extend `docs/PROCESS.md`, are project-agnostic and must stay identical across projects.

## 1. Shared claims

Optional rule for agents working in parallel in separate clones or directories. It is on only when `AGENTS.md` §10 sets `Shared claims` to `on`; when the setting is absent or has any other value, it is off and this section does not apply. With shared claims on, the item branch itself is the claim: once pushed, it is visible to every clone.

- Shared claims require an `origin` remote. Without one, report that claims cannot be shared and continue as with shared claims off.
- Before starting a `Todo` item, run `git fetch --prune origin` and check that no local or remote branch exists for the same ID (any branch named `<prefix><ID>-…`). If one exists, stop and report the branch, the date and the author of its last commit. Continue only if the user explicitly asks, and then switch to that branch instead of creating a new one. If the fetch fails, report it and ask before starting.
- Push the **item branch** right after every commit that changes the item's state in that branch: start (`In Progress`), `Blocked`, resume and `Done`. Use `git push -u origin <branch>` for the first push. `main` is pushed automatically only after adding an item (`docs/PROCESS.md` §6.1); merges follow `docs/PROCESS.md` §6.3 unchanged.
- If a push fails, keep the local commit, report that the claim is not shared, and do not start or continue the implementation until the user decides.
- The claim ends when the merged branch is deleted from the remote (`docs/PROCESS.md` §6.3).
- `--branches` (on `status`, `list`, `ready`, `show` and `export`) is the cross-clone view: it runs `git fetch --prune origin` (10 s timeout; `--no-fetch` skips it) and shows each item as it is on its item branch. Without the option, the backlog reflects only the current checkout. The rules:
  - item branches are the local and remote-tracking branches named `<prefix><ID>-…` (`docs/PROCESS.md` §6.1) that are not merged into local `main` or into a remote's default branch;
  - a local branch wins over the remote-tracking branch with the same name;
  - on an item branch, its own item keeps the working-tree copy;
  - with several branches for one ID, the one with the most recent commit wins; `show` lists it with the others, `export --json` gives them under `branches`;
  - items that exist only in a branch are not shown;
  - a failed fetch is only a warning: the last fetched refs are used.

## 2. Parallel work

Optional mode in which one agent, the orchestrator, runs several items at the same time through worker agents in separate clones. It is on only when `AGENTS.md` §10 sets `Parallel work` to `on`; when the setting is absent or has any other value, it is off and this section does not apply. It requires shared claims (§1): the pushed item branches are how the orchestrator sees progress. If `Shared claims` is not `on` or there is no `origin` remote, report it and do not start workers.

- **Roles:**
  - the **orchestrator** works in the main clone, always on a clean `main`. It selects, launches and follows workers, relays the user's go, merges and cleans up. It never implements items;
  - the orchestrator does not block while workers run: it follows them through their reports and stays available to the user. Meanwhile it may do backlog work that stays on `main` (adding items, `docs/PROCESS.md` §6.1, or planning items not yet launched), never implementation and never a branch switch. A report that arrives during such work is handled as soon as the current step ends;
  - each **worker** handles exactly one item, in its own clone.
- **Workspaces:**
  - one `git clone` from `origin` per item, in `<Workspace root>/<ID>/`. `Workspace root` comes from `AGENTS.md` §10; default `../<repo-name>-work`, relative to the main clone;
  - a fresh clone must be workable as it is. There is no setup hook: the worker prepares whatever the project documents (for example the install command in `AGENTS.md` §6).
- **Selection:** the orchestrator proposes ready items (`Todo`, all dependencies `Done`) that have no local or remote branch yet. Workers clone from `origin`: before launching, `main` must not be ahead of `origin/main`, otherwise (for example after a failed push of an added item) the orchestrator asks the user to push it (apart from adding items, pushing `main` stays an explicit user request). Ready items never depend on each other; the orchestrator also points out items likely to touch the same files or module. The user chooses which items to launch and how many. There is no fixed limit.
- **Workers:**
  - a launched worker runs the start of the `start-task` procedure in its clone: it claims the item (branch created and pushed, `In Progress`, §1), reads the referenced requirements and design, and reports `ready` to the orchestrator with a short plan (approach, files it will touch, open questions). Then it stops;
  - it implements the item only after an explicit **go** from the user, given directly in the worker or relayed by the orchestrator. Only when the user asks for it at launch may the orchestrator give the go together with the launch;
  - after the go it implements the item and completes it with the `finish-task` procedure, pushing the item branch on every state change (§1);
  - workers never merge, never push `main`, never remove clones and never start other agents;
  - they report `ready`, `done` or `blocked`, with a short detail, to the orchestrator.
- **Release:** a claimed item that never received the go can be released on explicit user request, as an exception to `docs/PROCESS.md` §6.3: only if its branch contains nothing but the start commit, the orchestrator ends the worker, deletes the item branch locally and on `origin`, and removes the clone (same checks as the cleanup). On `main` the item is still `Todo`.
- **Merge:**
  - only the orchestrator merges, in the main clone, one item at a time and only on explicit user request (`docs/PROCESS.md` §6.3 unchanged);
  - a conflict in `backlog/` is resolved as in `docs/PROCESS.md` §6.3. Any other conflict that is not trivially resolvable is reported to the user.
- **Cleanup:** after a verified merge and the deletion of the item branch, the orchestrator ends the worker's agent and removes its clone. It never removes a clone that has uncommitted changes or commits not contained in a remote branch; it reports such a clone to the user instead.
- The worker agent command comes from `AGENTS.md` §10 (`Worker agent command`, default `pi --approve`). How agents are started and followed is tooling (the `orchestrate` skill) and does not change these rules.
