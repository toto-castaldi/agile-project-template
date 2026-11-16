# AGENTS.md

> **Template not initialized.** This project was created from `agile-project-template` and has not been kicked off yet. The only item that may be started is `TEC-001 — Kickoff` (run the `kickoff` skill); its initial backlog planning takes place on `main` before starting the item branch. Remove this notice during the kickoff.

## 0. Process

This project follows the shared process in [`docs/PROCESS.md`](docs/PROCESS.md). Read it before doing any work; it says which files of `docs/process/` to read for each topic.

This file contains only project-specific rules. Where it conflicts with `docs/PROCESS.md`, the process wins unless the deviation is listed in [Process overrides](#8-process-overrides).

At the start of every session run `python3 .agents/tools/backlog.py status`, then `show` for the relevant items. Read and change the backlog only through that CLI (`docs/PROCESS.md` §3).

## 1. Project

- **Name:** `<project-name>`
- **Summary:** `<one or two sentences: what the project does and for whom>`
- **Current version:** see `python3 .agents/tools/backlog.py status`.
- **Requirements:** `docs/requirements/` · **Design:** `docs/design/` (one file each, list them with `python3 .agents/tools/backlog.py docs`; read only those you need)

## 2. Language

- **Project language:** `<e.g. Italian>`
- Project content (`docs/PROCESS.md` §2) and user-facing messages are written in the project language.
- Code identifiers and code comments: `<e.g. English>`.

## 3. Scope

The scope of the current version is defined in `docs/requirements/README.md`. Do not implement anything listed there as out of scope without first updating requirements and backlog and agreeing the scope change with the user.

`<Optional: two or three bullets with the most important scope boundaries the agent must keep in mind.>`

## 4. Stack and architecture

Unless a different decision is recorded in the backlog and in the technical design:

- `<language, runtime and version>`
- `<package manager>`
- `<frameworks and main libraries>`
- `<database / storage>`
- `<test framework>`
- `<local runtime, e.g. Docker Compose>`

Architecture and module boundaries: `<short description, details in docs/design/<topic>.md>`.

## 5. Domain rules

`<Invariants and business rules the agent must never violate, grouped by topic. Keep them short; the full specification is in docs/requirements/.>`

## 6. Quality gate

Closing gate (`docs/PROCESS.md` §6):

```bash
<lint command>
<typecheck command>
<in-memory unit test command>
<build command>
```

Preparation: `<install command>`.

Integration and end-to-end suites: `<commands, prerequisites, and any rule such as "do not mock the database to claim constraints are verified">`.

## 7. Definition of Done additions

In addition to `docs/PROCESS.md` §6:

- `<e.g. migrations are reproducible from a clean environment and verified during the item against a real database>`
- `<e.g. .env.example is updated when configuration changes>`

## 8. Process overrides

None.

## 9. Security and configuration

- Never commit secrets. Local configuration lives in `<e.g. .env>`, with a committed `<e.g. .env.example>` containing no real secrets.
- Do not log tokens, credentials or sensitive personal data.
- `<project-specific security rules>`

## 10. Parallel work

Settings of `docs/PROCESS-PARALLEL.md`, which explains them; read it before working on an item if `Shared claims` or `Parallel work` is `on`.

- **Shared claims:** `<on | off>`
- **Parallel work:** `<on | off>`
- **Workspace root:** `../<repo-name>-work`
- **Worker agent command:** `pi --approve`
