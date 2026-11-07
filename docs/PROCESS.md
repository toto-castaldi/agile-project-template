# Development Process

**Process version:** 1.5.0

This document defines the simplified Scrum process shared by every project created from `agile-project-template`. It is project-agnostic and must stay identical across projects, so that improvements made in the template can be copied over unchanged. Project-specific rules (stack, domain, quality gate commands, language) live in `AGENTS.md`.

If `AGENTS.md` needs to deviate from this process, it must do so explicitly in a `Process overrides` section. Otherwise this document wins.

## 1. Principles

- Work is driven by versioned documents, not by conversations. What is not written in the repository does not exist.
- Requirements (*what*) come before design (*how*), and design comes before implementation.
- Each item is small, traceable to requirements, developed in its own branch and closed only when its Definition of Done is met. Adding an item to the backlog is a separate documentation-only operation on `main` (§6.1).
- Documentation evolves incrementally with the work: a complete up-front design is not required.
- The agent never silently resolves inconsistencies: it reports the conflict, proposes an alignment and updates documents accordingly.
- No Sprints and no time estimates. Planning is expressed through versions, priorities and dependencies.

## 2. Language

- The **project language** is declared in `AGENTS.md`.
- Written in the project language: requirements, design, backlog titles and descriptions, acceptance criteria, status notes, README, CHANGELOG entries, ADRs, spike reports and commit message descriptions.
- Always in English (structural tokens, so skills and tooling stay stable across projects): file names, document section headings defined by the templates, field labels, states, priorities, IDs, branch prefixes and commit types.

## 3. Artifacts

| File | Role | Owner of |
| --- | --- | --- |
| `AGENTS.md` | Project-specific rules for coding agents | stack, architecture, domain rules, quality gate, language |
| `CLAUDE.md` | Entry point for Claude Code; imports `AGENTS.md` and this file | nothing else |
| `docs/PROCESS.md` | This process, shared by all projects | workflow rules |
| `docs/REQUIREMENTS.md` | Scope, actors, glossary, functional and non-functional requirements, release acceptance | the *what* |
| `docs/TECHNICAL-DESIGN.md` | Architecture, modules, data model, invariants, integrations, security, test strategy | the *how* |
| `docs/adr/` | Architecture Decision Records for relevant decisions not adequately captured in the design | decision history |
| `docs/spikes/` | Spike reports | research outcomes |
| `BACKLOG.md` | Product Backlog: versions, epics, items | canonical work state |
| `STATUS.md` | Short snapshot of the project | quick orientation |
| `CHANGELOG.md` | User-visible changes per released version | release history |
| `README.md` | Short presentation of the project, setup and usage commands | nothing process-related |

Rules:

- `README.md` must not contain process rules, item states or agent instructions.
- `BACKLOG.md` is the canonical source for items, dependencies and acceptance criteria. `STATUS.md` is derived from it and must always be consistent with it.
- A requirement change is recorded first in `docs/REQUIREMENTS.md`, then reflected in `BACKLOG.md` and, if needed, in `docs/TECHNICAL-DESIGN.md`.
- Design choices are recorded in `docs/TECHNICAL-DESIGN.md` together with the item that introduces them.
- Projects may define modules in `docs/TECHNICAL-DESIGN.md` §3. A module is a named part of the project, independent of epics and versions; it does not imply a Git submodule or a separate repository. Document each module's stable ID (`MOD-001`), name and responsibility, and its location or boundaries when known. IDs are sequential and never reused. Projects without modules need no module catalog.

## 4. Backlog model

### 4.1 Versions

- Versions follow Semantic Versioning: `vMAJOR.MINOR.PATCH`. The first version is `v0.1.0`.
- Each version has a goal (one or two sentences), a state (`Open` or `Closed`) and the list of items assigned to it.
- Only one version is `Open` at a time, unless a patch version is opened to fix bugs in a closed one.
- All items assigned to a version are required for that version, regardless of priority.
- Changing the scope of an open version (adding, removing or moving items) is allowed but must be agreed with the user and recorded in `BACKLOG.md` and `STATUS.md`.
- Ideas not yet assigned to a version go into the `Unassigned backlog` section of `BACKLOG.md`. They need requirements before they can be designed.

### 4.2 Epics

- Epics are thematic containers that describe the scope of the items they group.
- An epic has a stable ID (`EPIC-001`), a title and a short scope description.
- Epics have **no** state, acceptance criteria, branch or progress, and they are never opened or closed.
- Epics may span multiple versions.

### 4.3 Item types

| Type | ID | Purpose | Branch prefix |
| --- | --- | --- | --- |
| User Story | `US-001` | Value visible to an actor, expressed from the actor's point of view | `us/` |
| Task | `TEC-001` | Technical work: scaffold, infrastructure, refactoring, process | `task/` |
| Spike | `SPIKE-001` | Time-boxed-by-scope research answering explicit questions | `spike/` |
| Bug | `BUG-001` | Defect: behavior that contradicts requirements or acceptance criteria | `fix/` |

- IDs are stable, sequential per type and never reused, even if an item is dropped.
- A Spike produces a report in `docs/spikes/SPIKE-NNN-slug.md` (see `docs/spikes/_TEMPLATE.md`). Exploratory code written during a spike is not merged unless the spike's acceptance criteria say so.
- A Bug must describe steps to reproduce, expected and actual behavior, and its acceptance criteria must include a regression test.

### 4.4 Item fields

Every item is written in `BACKLOG.md` under its epic, inside the version section it belongs to:

```markdown
#### US-001 — Title in project language

- **Epic:** EPIC-001 — Epic title
- **Module:** MOD-001 — Module name              (optional)
- **Type:** User Story · **Priority:** P1 · **Status:** Todo
- **Branch:** `us/US-001-short-slug`            (set when the item starts)
- **Dependencies:** none | US-000, TEC-000
- **Requirements:** REQ-XXX-001, REQ-NFR-001     (mandatory for US and BUG)
- **Design references:** TECHNICAL-DESIGN §3, ADR-001   (mandatory for TEC when they produce or change design)
- **Description:** As a <actor>, I want <capability> so that <benefit>.   (US only, optional for others)
- **Acceptance criteria:**
  - Verifiable criterion.
  - Verifiable criterion.
- **Blocked by:** reason and external dependency   (only while Blocked)
- **Outcome:** one or two sentences with what was delivered and verified, closing date   (set when Done)
```

Bug items additionally contain:

```markdown
- **Found in:** v0.1.0
- **Steps to reproduce:** ...
- **Expected:** ...
- **Actual:** ...
```

Field rules:

- `Epic` is mandatory and contains ID and title.
- `Module` is optional for every item type. When present, it identifies one module from `docs/TECHNICAL-DESIGN.md` §3 by ID and name. Omit it for unassigned or cross-cutting work; do not invent a module. The epic and module are independent classifications.
- Every User Story and Bug references at least one requirement. Purely technical items reference the design sections they produce or change, or the process sections (`PROCESS §N`) they touch.
- Acceptance criteria are concrete and verifiable. Avoid vague wording such as "works well".
- Dates (`Outcome`, version states, and dates in `STATUS.md` and `CHANGELOG.md`) use `YYYY-MM-DD` and are the current date read from the system clock (`date +%F`) when the record is written. Never estimate or infer a date.

### 4.5 States

| State | Meaning |
| --- | --- |
| `Todo` | Not started |
| `In Progress` | Started in its dedicated branch |
| `Blocked` | Cannot proceed; the reason and any external dependency are recorded |
| `Done` | Definition of Done satisfied |

An item whose dependencies are not `Done` should not be started. If the user explicitly asks to start it anyway, record that in the item.

### 4.6 Priorities

| Priority | Meaning |
| --- | --- |
| `P0` | Foundations, invariants, blockers for other items |
| `P1` | Core functionality of the version |
| `P2` | Completion, polish, process improvements |

Priority orders the work inside a version; it does not decide whether an item belongs to the version.

## 5. Requirements and design

### 5.1 Requirements IDs

- Functional requirements: `REQ-<AREA>-NNN`, where `<AREA>` is a short uppercase code chosen per project (e.g. `REQ-AUTH-001`).
- Non-functional requirements: `REQ-NFR-NNN`.
- IDs are stable and never reused. A removed requirement is marked as `Withdrawn` with the reason, not deleted.

### 5.2 Technical design

- Sections of `docs/TECHNICAL-DESIGN.md` are numbered (`§1`, `§2`, …) so backlog items can reference them.
- Before designing or implementing an item, read its linked requirements and design sections; if it has a `Module`, also read that module's entry in §3.
- Use an ADR (`docs/adr/ADR-NNN-slug.md`, see `docs/adr/_TEMPLATE.md`) for decisions with relevant alternatives or long-term consequences that would bloat the design document.

## 6. Git workflow

### 6.1 Branches

- `main` is always releasable. It receives merges and, as the only exception for direct commits, documentation-only additions of new backlog items as described below.
- Every item is developed in its own branch created from an up-to-date `main`. Do not mix multiple backlog items in one branch.
- Branch name: `<prefix><ID>-<short-slug>`, slug in lowercase kebab-case, in the project language. Examples: `us/US-004-create-single-lesson`, `task/TEC-002-scaffold`, `spike/SPIKE-001-payment-provider`, `fix/BUG-003-timezone-offset`.
- Release branches: `release/vX.Y.Z` (see §9).
- Adding a new item of any type starts only on `main`, with a clean working tree and an up-to-date branch. If the current branch is not `main` or the working tree is dirty, stop and ask the user to resolve that state; do not switch branches, stash or discard changes automatically. When an upstream exists, update `main` with `git pull --ff-only` before making changes.
- Each item addition is documentation-only and uses exactly one `docs(<ID>)` commit directly on `main`, containing the new item and all related requirements, design and status updates. Do not include unrelated changes or implementation. No branch or merge is created for the addition; do not push unless the user explicitly requests it.
- If an item branch reveals a new dependency, do not add that item there: preserve the current work and ask the user to return to a clean `main` before starting the addition.
- Other backlog grooming (changing requirements, existing items, epics or version scope without adding an item or implementing anything) remains in a `backlog/<short-slug>` branch and is merged like an item branch. Commit type `docs`, scope the ID of the main item touched (e.g. `docs(US-014): aggiorna i criteri di accettazione`).

Starting an item:

```bash
git switch main
git pull --ff-only
git switch -c us/US-001-short-slug
```

### 6.2 Commits

Conventional Commits, with the item ID as scope and the description in the project language:

```text
<type>(<ID>): <description>
```

| Type | Use |
| --- | --- |
| `feat` | New functionality |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `test` | Tests only |
| `refactor` | Code change without behavior change |
| `chore` | Process, tooling, backlog/status updates, configuration |
| `merge` | Merge commit of an item or release branch into `main` |
| `release` | Version closing commit |

Examples: `feat(US-004): crea una lezione singola`, `chore(TEC-001): avvia attività`, `merge(US-004): crea una lezione singola`.

Commits must not contain secrets, credentials or local agent state.

### 6.3 Merge

- Merging into `main` is **never automatic**. When an item is complete, the agent leaves the work committed in the item branch and waits for an explicit user request before merging or pushing to `main`. Adding an item directly on `main` (§6.1) needs no merge and is not pushed automatically.
- The merge and push closing gate runs only lint, typecheck, build and in-memory unit tests as specified in `AGENTS.md`; integration and end-to-end evidence is gathered separately when needed.
- Merges use `git merge --no-ff` with message `merge(<ID>): <item title>`.
- The merge commit contains only the merge and the resolution of its conflicts. If the branch has an error (a wrong date, an inconsistent record, a failing check), do not fix it in the merge: report it and fix it first with a commit on the item branch (with parallel work, by its worker, §6.5), then merge.
- A merge conflict in `STATUS.md` is never resolved by hand or by picking a side: regenerate `STATUS.md` from the merged `BACKLOG.md` (§7). In `BACKLOG.md` keep both sides' changes, each item with its own most recent state.
- After a successful merge and push, delete the local and remote item branch, after verifying the branch is actually merged. Never delete unmerged branches, except when releasing an item that was claimed but never started (§6.5).

### 6.4 Shared claims

Optional rule for agents working in parallel in separate clones or directories. It is on only when `AGENTS.md` §10 sets `Shared claims` to `on`; when the setting is absent or has any other value, it is off and this subsection does not apply. With shared claims on, the item branch itself is the claim: once pushed, it is visible to every clone.

- Shared claims require an `origin` remote. Without one, report that claims cannot be shared and continue as with shared claims off.
- Before starting a `Todo` item, run `git fetch --prune origin` and check that no local or remote branch exists for the same ID (any branch named `<prefix><ID>-…`). If one exists, stop and report the branch, the date and the author of its last commit. Continue only if the user explicitly asks, and then switch to that branch instead of creating a new one. If the fetch fails, report it and ask before starting.
- Push the **item branch** right after every commit that changes the item's state in that branch: start (`In Progress`), `Blocked`, resume and `Done`. Use `git push -u origin <branch>` for the first push. `main` is never pushed automatically: §6.3 does not change.
- If a push fails, keep the local commit, report that the claim is not shared, and do not start or continue the implementation until the user decides.
- The claim ends when the merged branch is deleted from the remote (§6.3).
- `STATUS.md` on `main` still reflects only merged state; the cross-clone view comes from the item branches themselves.

### 6.5 Parallel work

Optional mode in which one agent, the orchestrator, runs several items at the same time through worker agents in separate clones. It is on only when `AGENTS.md` §10 sets `Parallel work` to `on`; when the setting is absent or has any other value, it is off and this subsection does not apply. It requires shared claims (§6.4): the pushed item branches are how the orchestrator sees progress. If `Shared claims` is not `on` or there is no `origin` remote, report it and do not start workers.

- **Roles:**
  - the **orchestrator** works in the main clone, always on a clean `main`. It selects, launches and follows workers, relays the user's go, merges and cleans up. It never implements items;
  - each **worker** handles exactly one item, in its own clone.
- **Workspaces:**
  - one `git clone` from `origin` per item, in `<Workspace root>/<ID>/`. `Workspace root` comes from `AGENTS.md` §10; default `../<repo-name>-work`, relative to the main clone;
  - a fresh clone must be workable as it is. There is no setup hook: the worker prepares whatever the project documents (for example the install command in `AGENTS.md` §6).
- **Selection:** the orchestrator proposes ready items (`Todo`, all dependencies `Done`) that have no local or remote branch yet. Ready items never depend on each other; the orchestrator also points out items likely to touch the same files or module. The user chooses which items to launch and how many. There is no fixed limit.
- **Workers:**
  - a launched worker runs the start of the `start-task` procedure in its clone: it claims the item (branch created and pushed, `In Progress`, §6.4), reads the referenced requirements and design, and reports `ready` to the orchestrator with a short plan (approach, files it will touch, open questions). Then it stops;
  - it implements the item only after an explicit **go** from the user, given directly in the worker or relayed by the orchestrator. Only when the user asks for it at launch may the orchestrator give the go together with the launch;
  - after the go it implements the item and completes it with the `finish-task` procedure, pushing the item branch on every state change (§6.4);
  - workers never merge, never push `main`, never remove clones and never start other agents;
  - they report `ready`, `done` or `blocked`, with a short detail, to the orchestrator.
- **Release:** a claimed item that never received the go can be released on explicit user request, as an exception to §6.3: only if its branch contains nothing but the start commit, the orchestrator ends the worker, deletes the item branch locally and on `origin`, and removes the clone (same checks as the cleanup). On `main` the item is still `Todo`.
- **Merge:**
  - only the orchestrator merges, in the main clone, one item at a time and only on explicit user request (§6.3 unchanged);
  - a conflict in `STATUS.md` is resolved by regenerating it from the merged `BACKLOG.md` (§6.3). Any other conflict that is not trivially resolvable is reported to the user.
- **Cleanup:** after a verified merge and the deletion of the item branch, the orchestrator ends the worker's agent and removes its clone. It never removes a clone that has uncommitted changes or commits not contained in a remote branch; it reports such a clone to the user instead.
- The worker agent command comes from `AGENTS.md` §10 (`Worker agent command`, default `pi`). How agents are started and followed is tooling (the `orchestrate` skill) and does not change these rules.

## 7. STATUS.md

`STATUS.md` is the short snapshot the agent reads first. It contains at least:

- last update date;
- current version, its phase (one short sentence) and progress (`done/total` items and percentage);
- item counts per state;
- items `In Progress` with epic and branch;
- items `Blocked` with epic and reason;
- the last 10 completed items with epic and closing date;
- next ready items (state `Todo` with all dependencies `Done`), ordered by priority;
- closed versions with closing date and tag;
- short notes: at most a few lines of cross-cutting information. Per-item details belong in the item's `Outcome` field, not here.

When a displayed item has a `Module`, include its module ID in that entry; use `—` for items without one when a module column is present. Epics and modules in `STATUS.md` only classify items: no epic or module states or progress.

### Automatic updates

The agent updates `STATUS.md` together with `BACKLOG.md`, without waiting for a request, whenever an item starts, gets blocked, resumes, is completed or reopened, when the scope of a version changes and when a version is closed.

- The update happens in the same branch and in the same commit as the event that causes it. Its date comes from the system clock (§4.4). If an item's module assignment changes, update any displayed entry in `STATUS.md` in the same commit.
- Before completing an item, verify that counts and states in `STATUS.md` match `BACKLOG.md`. If they don't, report the inconsistency and align both files.

## 8. Definition of Done

An item is `Done` only when:

1. all acceptance criteria are satisfied;
2. the closing quality gate defined in `AGENTS.md` passes: lint, typecheck, build and in-memory unit tests only, without test-created processes, filesystem, git, network or Docker; dependency installation and compilation are preparation, not test behavior;
3. new behavior is covered by tests at the cheapest level that proves it, and bugs have a regression test; integration and end-to-end tests are run separately during the item whenever needed to prove its acceptance criteria or project-specific requirements;
4. no secrets are present in files, commits or logs;
5. requirements, technical design, ADRs, configuration examples and README are updated where needed;
6. a line describing the change is added under `[Unreleased]` in `CHANGELOG.md` for user-visible changes;
7. `BACKLOG.md` (state `Done`, `Outcome`) and `STATUS.md` reflect the real state and are consistent with each other;
8. all the work is committed in the item's dedicated branch;
9. the project-specific additions to the Definition of Done in `AGENTS.md` are satisfied.

If a criterion cannot be met, the item is not `Done`: either keep working, mark it `Blocked` with the reason, or agree with the user to split it.

## 9. Closing a version

A version can be closed only on explicit user request and only when:

- every item assigned to it is `Done`;
- the release acceptance criteria in `docs/REQUIREMENTS.md` are satisfied;
- the closing quality gate passes on an up-to-date `main`, and all separately defined integration suites pass; end-to-end evidence requiring external services and credentials is verified separately as required by release acceptance.

Procedure:

1. Create `release/vX.Y.Z` from up-to-date `main`.
2. In `CHANGELOG.md`, rename `[Unreleased]` to `[X.Y.Z] - YYYY-MM-DD` and add a new empty `[Unreleased]` section.
3. In `BACKLOG.md`, mark the version `Closed` with the date; open the next version if the user has defined it.
4. In `STATUS.md`, move the version to closed versions with date and tag, and update the current version.
5. Commit `release(vX.Y.Z): <short description>`, merge `--no-ff` into `main` with `merge(vX.Y.Z): release`, then create the annotated tag `vX.Y.Z` on the merge commit.
6. Push `main` and the tag, then delete the release branch.

## 10. Agent operating loop

1. At the start of a session, read `STATUS.md`, then the relevant parts of `BACKLOG.md`.
2. Before working on an item, read its requirements and design references.
3. New work not in the backlog is first added to the backlog (and to requirements if it changes behavior) before implementation.
4. If the request is ambiguous, conflicts with documents or changes the scope of the version, ask before acting.
5. Report outcomes faithfully: failing tests, skipped steps and unverified behavior are stated explicitly.

### Skills

The repository provides skills in `.agents/skills/` (exposed to Claude Code through `.claude/skills/`) that run the procedures of this document:

| Skill | Procedure |
| --- | --- |
| `kickoff` | Initialize a new project from the template (item `TEC-001`) |
| `add-item` | Add a requirement and/or backlog item |
| `start-task` | Start an item: branch, state, status |
| `finish-task` | Verify the Definition of Done and complete an item in its branch |
| `merge-task` | Merge a completed item into `main` (explicit request only) |
| `close-version` | Close a version (explicit request only) |
| `orchestrate` | Run items in parallel through worker agents in separate clones (explicit request only, §6.5) |

Skills are shortcuts: the rules are in this document and in `AGENTS.md`, and they apply even when work is requested in natural language.

The repository may also ship agent-specific tooling besides skills (for example read-only viewers). Such tooling never changes the rules of this document.
