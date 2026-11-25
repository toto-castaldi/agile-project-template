# Parallel work

Optional rules, read only when `AGENTS.md` §10 turns on `Shared claims` or `Parallel work`: a worker needs §1 and the workers' part of §2; the orchestrator also follows the `orchestrate` skill. They extend `docs/PROCESS.md`, are project-agnostic and must stay identical across projects.

## 1. Shared claims

Optional rule for agents working in parallel in separate clones or directories. It is on only when `AGENTS.md` §10 sets `Shared claims` to `on`; when the setting is absent or has any other value, it is off and this section does not apply. With shared claims on, the item branch itself is the claim: once pushed, it is visible to every clone.

- Shared claims require an `origin` remote. Without one, report that claims cannot be shared and continue as with shared claims off.
- Before starting a `Todo` item, run `git fetch --prune origin` and check that no local or remote branch exists for the same ID (any branch named `<prefix><ID>-…`). If one exists, stop and report the branch, the date and the author of its last commit. Continue only if the user explicitly asks, and then switch to that branch instead of creating a new one. If the fetch fails, report it and ask before starting.
- Push the **item branch** right after every commit that changes the item's state in that branch: start (`In Progress`), `Blocked`, resume and `Done`. Use `git push -u origin <branch>` for the first push. `main` is pushed automatically only after adding an item (`docs/process/git.md` §1); merges follow `docs/process/git.md` §3 unchanged.
- If a push fails, keep the local commit, report that the claim is not shared, and do not start or continue the implementation until the user decides.
- The claim ends when the merged branch is deleted from the remote (`docs/process/git.md` §3).
- `--branches` (on `status`, `list`, `ready`, `show` and `export`) shows each item as it is on its item branch, so every clone sees the claims of the others (`docs/process/backlog.md` §5).

## 2. Parallel work

Optional mode in which one agent, the orchestrator, runs several items at the same time through worker agents in separate clones. It is on only when `AGENTS.md` §10 sets `Parallel work` to `on`; when the setting is absent or has any other value, it is off and this section does not apply. It requires shared claims (§1): the pushed item branches are how the orchestrator sees progress. If `Shared claims` is not `on` or there is no `origin` remote, report it and do not start workers.

- **Orchestrator:** works in the main clone, always on a clean `main`. It selects, launches and follows workers, relays the user's go, merges and cleans up, and never implements items. Its procedure and rules are the `orchestrate` skill.
- **Settings** (`AGENTS.md` §10): `Workspace root` is the folder of the worker clones, one per item in `<Workspace root>/<ID>/`, default `../<repo-name>-work`, relative to the main clone. `Worker agent command` starts a worker, default `pi --approve`: workers run unattended, so it must not prompt, and `--approve` makes pi trust the project-local files of the clone for that run only. An orchestrator running in Claude Code ignores it and starts Claude Code workers.
- **Workers:** each worker handles exactly one item, in its own clone.
  - A fresh clone must be workable as it is. There is no setup hook: the worker prepares whatever the project documents (for example the install command in `AGENTS.md` §6).
  - A launched worker runs the start of the `start-task` procedure in its clone: it claims the item (branch created and pushed, `In Progress`, §1), reads the referenced requirements and design, and prepares a short plan (approach, files it will touch).
  - By default the launch is the **go**: without open questions, the worker reports `started` to the orchestrator with its plan and implements the item.
  - With open questions for the user (a choice the item, requirements and design do not settle), it reports `ready` with the plan and the questions, stops, and implements only after an explicit go from the user, given directly in the worker or relayed by the orchestrator. When the user asks at launch to review the plans first, every worker reports `ready` and waits for the go.
  - It completes the item with the `finish-task` procedure, pushing the item branch on every state change (§1).
  - Workers never merge, never push `main`, never remove clones and never start other agents.
  - They report `started`, `ready`, `done` or `blocked`, with a short detail, to the orchestrator.
- **Release:** on explicit user request, a claimed item whose worker is waiting for the go and whose branch contains nothing but the start commit can be released: its branch is deleted and its clone removed, as an exception to `docs/process/git.md` §3. On `main` the item is still `Todo`.
