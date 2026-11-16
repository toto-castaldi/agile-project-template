# Development Process

**Process version:** 4.0.0

The simplified Scrum process shared by every project created from `agile-project-template`. It is project-agnostic and must stay identical across projects. Project-specific rules live in `AGENTS.md`; a deviation from this process must be listed in its `Process overrides` section, otherwise this document wins.

This file holds the rules every session needs. The detailed rules of a topic are in `docs/process/` (§3) and are read only when the work touches that topic. If `AGENTS.md` §10 turns on `Shared claims` or `Parallel work`, read `docs/PROCESS-PARALLEL.md` before working on an item.

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
| `docs/PROCESS.md`, `docs/process/`, `docs/PROCESS-PARALLEL.md` | workflow rules |
| `docs/requirements/` | the *what*: one file per requirement |
| `docs/design/` | the *how*: one file per topic, optional module catalog in `modules.md` |
| `docs/adr/`, `docs/spikes/` | decisions and research outcomes |
| `backlog/` | canonical work state |
| `CHANGELOG.md` | user-visible changes per released version |
| `README.md` | presentation, setup and usage; no process rules, item states or agent instructions |

Detailed rules, read when the work touches their topic:

| File | Read before |
| --- | --- |
| `docs/process/backlog.md` | changing versions, epics or item fields, or reading the project status in detail |
| `docs/process/docs.md` | writing or changing requirements, design, ADRs or spike reports |
| `docs/process/git.md` | adding an item, using a grooming branch, merging or resolving a conflict |
| `docs/process/release.md` | closing a version |

- Agents read and change `backlog/` **only** through the CLI (`python3 .agents/tools/backlog.py`, written `backlog` here and in the skills; Python 3.10+) and never read, search or edit its files directly. The only exception is resolving a merge conflict (`docs/process/git.md` §3).
- Requirements and design are split into small files so that agents load only what a task needs: `backlog docs` lists them, `backlog docs --for <ID>` lists the files an item references, and an agent reads those files, never whole folders.
- A requirement change is recorded first in `docs/requirements/`, then in `backlog/` and, if needed, in the design. Design choices are recorded together with the item that introduces them.
- Adopting a new version of the template (process, skills, tools) is a `task/` item that references the process sections it adopts; it needs no requirement, because the process is not part of the product. The adopted version is the `Process version` of this file.

## 4. Backlog model

Versions (Semantic Versioning, from `v0.1.0`; one `Open` at a time) contain items, grouped by thematic epics (`EPIC-001`). Every item assigned to a version is required for it, regardless of priority. Details: `docs/process/backlog.md`.

### 4.1 Item types

| Type | ID | Purpose | Branch prefix |
| --- | --- | --- | --- |
| User Story | `US-001` | Value visible to an actor | `us/` |
| Task | `TEC-001` | Technical work: scaffold, infrastructure, refactoring, process | `task/` |
| Spike | `SPIKE-001` | Research answering explicit questions | `spike/` |
| Bug | `BUG-001` | Behavior that contradicts requirements or acceptance criteria | `fix/` |

- IDs are stable and never reused.
- A Spike produces a report in `docs/spikes/SPIKE-NNN-slug.md`. Its exploratory code is not merged unless its acceptance criteria say so.
- A Bug describes steps to reproduce, expected and actual behavior, and its acceptance criteria include a regression test.

### 4.2 States

`Todo`, `In Progress` (started in its branch), `Blocked` (reason recorded), `Done` (Definition of Done satisfied), `Dropped` (abandoned; the file is kept).

An item whose dependencies are not `Done` is not started. If the user explicitly asks to start it anyway, use `backlog start --override-dependencies`.

Every state change goes through a CLI command in the same commit as the work that causes it. Dates in `backlog/` come from the CLI; dates in `CHANGELOG.md` are read with `date +%F`. Never estimate or infer a date.

### 4.3 Priorities

`P0` foundations, invariants, blockers · `P1` core functionality · `P2` completion and polish. Priority orders the work inside a version; it does not decide whether an item belongs to it.

## 5. Git workflow

### 5.1 Branches

- `main` is always releasable. Every item is developed in its own branch from an up-to-date `main`: `<prefix><ID>-<short-slug>`, slug in lowercase kebab-case. One item per branch.
- A new item is added only on a clean, up-to-date `main`, in one documentation-only commit, never on an item branch (`docs/process/git.md` §1).
- Other branches: `backlog/<short-slug>` for other backlog grooming, `release/vX.Y.Z` for releases (`docs/process/git.md` §2).

### 5.2 Commits

`<type>(<ID>): <description>`, description in the project language. Types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore` (process, tooling, backlog state changes, configuration), `merge`, `release`. No secrets, credentials or local agent state.

### 5.3 Merge

Merging into `main` is **never automatic**: leave the work committed in the item branch and wait for an explicit user request before merging or pushing to `main`. Rules: `docs/process/git.md` §3.

## 6. Definition of Done

An item is `Done` only when:

1. all acceptance criteria are satisfied;
2. the closing gate of `AGENTS.md` §6 passes: lint, typecheck, build and in-memory unit tests only, which run without test-created processes, filesystem, git, network or Docker (installing dependencies and compiling are preparation). The same gate runs before a merge is pushed and when closing a version; adding a backlog item needs no gate;
3. new behavior is covered by tests at the cheapest level that proves it, bugs have a regression test, and integration and end-to-end suites are run separately, during the item, whenever needed to prove the criteria; they are not part of the closing gate;
4. no secrets are in files, commits or logs;
5. requirements, design, ADRs, configuration examples and README are updated where needed, requirements and design describing the current state (`docs/process/docs.md` §3);
6. a line is added under `[Unreleased]` in `CHANGELOG.md` for user-visible changes;
7. the item is `Done` with its `outcome`, and `backlog check` passes;
8. all the work is committed in the item's branch;
9. the additions in `AGENTS.md` are satisfied.

If a criterion cannot be met, the item is not `Done`: keep working, mark it `Blocked`, or agree a split with the user.

## 7. Agent operating loop

1. At the start of a session, run `backlog status`, then `backlog show` for the relevant items.
2. Before working on an item, read the files listed by `backlog docs --for <ID>`, and only those.
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
