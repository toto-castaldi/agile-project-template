# AGENTS.md

> **Template not initialized.** This project was created from `agile-project-template` and has not been kicked off yet. The only item that may be started is `TEC-001 — Kickoff` (run the `kickoff` skill); its initial backlog planning takes place on `main` before starting the item branch. Remove this notice during the kickoff.

## 0. Process

This project follows the shared process in [`docs/PROCESS.md`](docs/PROCESS.md). Read it before doing any work: it defines backlog, items, states, branches, commits, merges, project status, the Definition of Done and version closing.

This file contains only project-specific rules. Where it conflicts with `docs/PROCESS.md`, the process wins unless the deviation is listed in [Process overrides](#8-process-overrides).

At the start of every session run `python3 .agents/tools/backlog.py status`, then `show` for the relevant items. Read and change the backlog only through that CLI (`docs/PROCESS.md` §3).

## 1. Project

- **Name:** `<project-name>`
- **Summary:** `<one or two sentences: what the project does and for whom>`
- **Current version:** see `python3 .agents/tools/backlog.py status`.
- **Requirements:** `docs/REQUIREMENTS.md` · **Design:** `docs/TECHNICAL-DESIGN.md`

## 2. Language

- **Project language:** `<e.g. Italian>`
- Write project content (requirements, design, backlog text, notes, README, CHANGELOG, commit descriptions, user-facing messages) in the project language, as defined in `docs/PROCESS.md` §2.
- Code identifiers and code comments: `<e.g. English>`.

## 3. Scope

The scope of the current version is defined in `docs/REQUIREMENTS.md`. Do not implement anything listed there as out of scope without first updating requirements and backlog and agreeing the scope change with the user.

`<Optional: two or three bullets with the most important scope boundaries the agent must keep in mind.>`

## 4. Stack and architecture

Unless a different decision is recorded in the backlog and in the technical design:

- `<language, runtime and version>`
- `<package manager>`
- `<frameworks and main libraries>`
- `<database / storage>`
- `<test framework>`
- `<local runtime, e.g. Docker Compose>`

Architecture and module boundaries: `<short description, details in TECHNICAL-DESIGN §N>`.

## 5. Domain rules

`<Invariants and business rules the agent must never violate, grouped by topic. Keep them short; the full specification is in docs/REQUIREMENTS.md.>`

## 6. Quality gate

The closing gate for items, merges and pushes to `main` runs only:

```bash
<lint command>
<typecheck command>
<in-memory unit test command>
<build command>
```

Prepare dependencies separately using `<install command>`. Unit tests run in memory without test-created processes, filesystem, git, network or Docker; dependency installation and compilation are preparation, not test behavior.

Run integration and end-to-end suites separately during an item when needed to prove acceptance criteria or project-specific DoD. Run all integration suites at version closure and in CI; evaluate end-to-end evidence requiring external services or credentials separately as required by release acceptance.

Separate test commands and guidelines: `<integration and end-to-end commands, prerequisites, and any rule such as "do not mock the database to claim constraints are verified">`.

## 7. Definition of Done additions

In addition to `docs/PROCESS.md` §8:

- `<e.g. migrations are reproducible from a clean environment and verified during the item against a real database>`
- `<e.g. .env.example is updated when configuration changes>`

## 8. Process overrides

None.

## 9. Security and configuration

- Never commit secrets. Local configuration lives in `<e.g. .env>`, with a committed `<e.g. .env.example>` containing no real secrets.
- Do not log tokens, credentials or sensitive personal data.
- `<project-specific security rules>`

## 10. Parallel work

If either setting below is `on`, read `docs/PROCESS-PARALLEL.md` before working on an item.

- **Shared claims:** `<on | off>`
- **Parallel work:** `<on | off>`
- **Workspace root:** `../<repo-name>-work`
- **Worker agent command:** `pi --approve`

With `Shared claims` `on`, item branches are pushed at every state change so that agents in other clones see which items are taken (`docs/PROCESS-PARALLEL.md` §1). Requires an `origin` remote.

With `Parallel work` `on`, the `orchestrate` skill runs several items at once: one worker agent per item, started with `Worker agent command` in its own clone under `Workspace root` (`docs/PROCESS-PARALLEL.md` §2). Requires `Shared claims` `on`. Workers run unattended, so the command must start without interactive prompts: `--approve` makes pi trust the project-local files of the clone for that run only.
