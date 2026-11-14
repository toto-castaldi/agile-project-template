# Development Process

**Process version:** 3.0.0

The simplified Scrum process shared by every project created from `agile-project-template`. It is project-agnostic and must stay identical across projects. Project-specific rules live in `AGENTS.md`; a deviation from this process must be listed in its `Process overrides` section, otherwise this document wins.

If `AGENTS.md` §10 turns on `Shared claims` or `Parallel work`, read `docs/PROCESS-PARALLEL.md` before working on an item.

## 1. Principles

- Work is driven by versioned documents, not by conversations. What is not written in the repository does not exist.
- Requirements (*what*) come before design (*how*), and design before implementation. Documentation evolves with the work: a complete up-front design is not required.
- Each item is small, traceable to requirements, developed in its own branch and closed only when its Definition of Done is met.
- Never silently resolve inconsistencies: report the conflict, propose an alignment and update the documents.
- No Sprints and no time estimates. Planning uses versions, priorities and dependencies.

## 2. Language

- The **project language** is declared in `AGENTS.md`. Written in it: requirements, design, backlog text, notes, README, CHANGELOG entries, ADRs, spike reports and commit descriptions.
- Always in English: file names, section headings defined by the templates, field labels, states, priorities, IDs, branch prefixes and commit types.

## 3. Artifacts

| File | Owner of |
| --- | --- |
| `AGENTS.md` | project-specific rules: stack, architecture, domain, quality gate, language |
| `docs/PROCESS.md`, `docs/PROCESS-PARALLEL.md` | workflow rules |
| `docs/requirements/` | the *what*: one file per requirement (§5.1) |
| `docs/design/` | the *how*: one file per topic, optional module catalog in `modules.md` (§5.2) |
| `docs/adr/`, `docs/spikes/` | decisions and research outcomes |
| `backlog/` | canonical work state |
| `CHANGELOG.md` | user-visible changes per released version |
| `README.md` | presentation, setup and usage; no process rules, item states or agent instructions |

- Agents read and change `backlog/` **only** through the CLI (`python3 .agents/tools/backlog.py`, written `backlog` here and in the skills; Python 3.10+) and never read, search or edit its files directly. The only exception is resolving a merge conflict (§6.3).
- Requirements and design are split into small files so that agents load only what a task needs: `backlog docs` lists them, and an agent reads the files that the item references, never whole folders.
- A requirement change is recorded first in `docs/requirements/`, then in `backlog/` and, if needed, in the design. Design choices are recorded together with the item that introduces them.
- Adopting a new version of the template (process, skills, tools) is a `task/` item that references the process sections it adopts; it needs no requirement, because the process is not part of the product. The adopted version is the `Process version` of this file.

## 4. Backlog model

### 4.1 Versions

- Semantic Versioning, starting at `v0.1.0`. States: `Planned`, `Open`, `Closed`. Only one version is `Open`, unless a patch version is opened to fix bugs in a closed one.
- All items assigned to a version are required for it, regardless of priority.
- Changing the scope of an open version must be agreed with the user and recorded in `backlog/` (`backlog version edit --scope-change`).
- Ideas not assigned to a version are recorded with `backlog ideas --add`, one line each, without an ID. An item with full fields may stay without a version (`backlog add --unassigned`): it is never ready and cannot start until it has one. Both need requirements before they can be designed, and an item needs acceptance criteria before it gets a version.

### 4.2 Epics

Thematic containers (`EPIC-001`) with a title and a scope. No state, acceptance criteria, branch or progress; they may span versions.

### 4.3 Item types

| Type | ID | Purpose | Branch prefix |
| --- | --- | --- | --- |
| User Story | `US-001` | Value visible to an actor | `us/` |
| Task | `TEC-001` | Technical work: scaffold, infrastructure, refactoring, process | `task/` |
| Spike | `SPIKE-001` | Research answering explicit questions | `spike/` |
| Bug | `BUG-001` | Behavior that contradicts requirements or acceptance criteria | `fix/` |

- IDs are stable and never reused.
- A Spike produces a report in `docs/spikes/SPIKE-NNN-slug.md`. Its exploratory code is not merged unless its acceptance criteria say so.
- A Bug describes steps to reproduce, expected and actual behavior, and its acceptance criteria include a regression test.

### 4.4 Item fields

`backlog add --help`, `backlog edit --help` and `backlog show` give the fields; the CLI rejects invalid records.

- Every User Story and Bug assigned to a version references at least one requirement. Technical items reference the design or process sections they produce or change.
- `requirements` lists requirement IDs, each the file `docs/requirements/<ID>.md`. `design_references` lists design topics as `design/<topic>` (the file `docs/design/<topic>.md`), other files of `docs/requirements/` as `requirements/<name>`, ADRs (`ADR-NNN`) and sections of the process or of `AGENTS.md` (`PROCESS §N`, `AGENTS §N`). `backlog check` rejects a `design/` or `requirements/` reference whose file does not exist, and an open item that references a `Withdrawn` requirement.
- Acceptance criteria are concrete and verifiable. Avoid wording such as "works well".
- `remarks` holds information that fits no other field, such as a later decision about the item.
- `module` is optional and independent of the epic; it need not be a Git submodule. Do not invent one: it must be in `docs/design/modules.md`, with a stable ID (`MOD-001`), sequential and never reused, a name, a responsibility and its location when known.
- Dates in `backlog/` come from the CLI. Dates in `CHANGELOG.md` are read with `date +%F`. Never estimate or infer a date.

### 4.5 States

`Todo`, `In Progress` (started in its branch), `Blocked` (reason recorded), `Done` (Definition of Done satisfied), `Dropped` (abandoned; the file is kept).

An item whose dependencies are not `Done` is not started. If the user explicitly asks to start it anyway, use `backlog start --override-dependencies`.

### 4.6 Priorities

`P0` foundations, invariants, blockers · `P1` core functionality · `P2` completion and polish. Priority orders the work inside a version; it does not decide whether an item belongs to it.

## 5. Requirements and design

### 5.1 Requirements

- `docs/requirements/README.md` holds the target version, goal, actors, scope in and out of the open version and the requirement areas; `glossary.md` the glossary; `acceptance.md` the release acceptance of the open version.
- One file per requirement, `docs/requirements/<ID>.md`, copied from `_TEMPLATE.md`: first line `# <ID> — <title>`, then `**State:** Active` or `**State:** Withdrawn`.
- IDs: functional `REQ-<AREA>-NNN`, non-functional `REQ-NFR-NNN`. IDs are stable and never reused; a removed requirement keeps its file, marked `Withdrawn` with the reason.

### 5.2 Technical design

- `docs/design/README.md` holds the target version, the initial architectural decisions and the open decisions with the items that will close them. Every other file is one topic, `docs/design/<topic>.md` in lowercase kebab-case, copied from `_TEMPLATE.md`, first line `# <title>`. The optional module catalog is `docs/design/modules.md`.
- A topic covers one subject; when it grows to cover more, split it and update the references of the open items.
- Before designing or implementing an item, read the files of its requirements and design references and, if it has a `module`, its entry in `docs/design/modules.md`.
- Use an ADR (`docs/adr/ADR-NNN-slug.md`) for decisions with relevant alternatives or long-term consequences.

### 5.3 Writing requirements and design

- They describe the current state of the product, not its history: when an item changes a requirement or a design choice, rewrite the text, do not append to it.
- No item IDs, dates, decision narratives or verification evidence in them, except the items that will close an open decision. History lives in the backlog (`remarks`, `outcome`, scope changes), in ADRs and in git.
- Scope and release acceptance hold only the open version: closing a version removes those of the closed one (§9).

## 6. Git workflow

### 6.1 Branches

- `main` is always releasable. Every item is developed in its own branch from an up-to-date `main`: `<prefix><ID>-<short-slug>`, slug in lowercase kebab-case. One item per branch.
- A new item of any type is added only on a clean, up-to-date `main`, with `git pull --ff-only` when an upstream exists. If that is not the state, stop and ask the user; do not switch branches, stash or discard changes.
- Each addition is exactly one documentation-only `docs(<ID>)` commit directly on `main`, with the new item and its requirements and design updates. No branch or merge. If `main` has an upstream, it must have no other unpushed commits before the addition, and the commit is pushed at once so that every clone sees it; a rejected push is rebased with `git pull --rebase`, checked with `backlog check` and pushed again, or reported on conflict. This is the only automatic push of `main`.
- If an item branch reveals a new dependency, do not add that item there: preserve the work and ask the user to return to a clean `main`.
- Other backlog grooming uses a `backlog/<short-slug>` branch, merged like an item branch, with commit type `docs` and the main item touched as scope. Release branches are `release/vX.Y.Z`.

### 6.2 Commits

`<type>(<ID>): <description>`, description in the project language. Types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore` (process, tooling, backlog state changes, configuration), `merge`, `release`. No secrets, credentials or local agent state.

### 6.3 Merge

- Merging into `main` is **never automatic**: leave the work committed in the item branch and wait for an explicit user request before merging or pushing to `main`.
- The closing gate before merge and push runs only lint, typecheck, build and in-memory unit tests as specified in `AGENTS.md`.
- `git merge --no-ff` with message `merge(<ID>): <item title>`.
- The merge commit contains only the merge and its conflict resolution. Fix errors on the branch first.
- If a record in `backlog/` conflicts, keep both sides' changes in that file, or the lines of both sides in `NOTES.md` and `IDEAS.md`, then run `backlog check`.
- After a successful merge and push, delete the local and remote branch after verifying it is merged. Never delete unmerged branches, except when releasing a claimed item that was never started (`docs/PROCESS-PARALLEL.md` §2).

## 7. Project status

The status is computed from `backlog/` and never stored. `backlog status` shows, in a size that does not grow with the backlog: open versions with progress, items in progress and blocked, next ready items, last completed items, closed versions and notes. `backlog list`, `ready` and `show` give the rest. `backlog export` prints everything as Markdown for a human.

Notes (`backlog notes`) are at most a few lines of cross-cutting information. Per-item details belong in the item's `outcome`.

`backlog check` validates the store. Every state change goes through a CLI command in the same commit as the work that causes it.

## 8. Definition of Done

An item is `Done` only when:

1. all acceptance criteria are satisfied;
2. the closing quality gate in `AGENTS.md` passes: lint, typecheck, build and in-memory unit tests only;
3. new behavior is covered by tests at the cheapest level that proves it, bugs have a regression test, and integration and end-to-end tests are run separately whenever needed to prove the criteria;
4. no secrets are in files, commits or logs;
5. requirements, design, ADRs, configuration examples and README are updated where needed;
6. a line is added under `[Unreleased]` in `CHANGELOG.md` for user-visible changes;
7. the item is `Done` with its `outcome`, and `backlog check` passes;
8. all the work is committed in the item's branch;
9. the additions in `AGENTS.md` are satisfied.

If a criterion cannot be met, the item is not `Done`: keep working, mark it `Blocked`, or agree a split with the user.

## 9. Closing a version

Only on explicit user request, and only when every item is `Done` or `Dropped`, the release acceptance criteria in `docs/requirements/acceptance.md` are satisfied, and the closing gate and all integration suites pass on an up-to-date `main`. Closing also compacts requirements and design (§5.3): the scope and acceptance of the closed version are removed and the files changed during the version are condensed to the current state. The procedure is in the `close-version` skill.

## 10. Agent operating loop

1. At the start of a session, run `backlog status`, then `backlog show` for the relevant items.
2. Before working on an item, read the files of its requirements and design references, and only those.
3. New work not in the backlog is added first (and to requirements if it changes behavior).
4. If a request is ambiguous, conflicts with documents or changes the scope of the version, ask before acting.
5. Report outcomes faithfully: failing tests, skipped steps and unverified behavior are stated explicitly.

### Skills

Procedures in `.agents/skills/`. The rules apply even when work is requested in natural language.

| Skill | Procedure |
| --- | --- |
| `kickoff` | Initialize a new project (item `TEC-001`) |
| `add-item` | Add a requirement and/or backlog item |
| `start-task` | Start an item: branch and state |
| `finish-task` | Verify the Definition of Done and complete an item in its branch |
| `merge-task` | Merge a completed item into `main` (explicit request only) |
| `close-version` | Close a version (explicit request only) |
| `orchestrate` | Run items in parallel through worker agents (explicit request only, `docs/PROCESS-PARALLEL.md` §2) |

Other agent tooling, such as read-only viewers, never changes these rules.
