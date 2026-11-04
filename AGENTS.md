# AGENTS.md

> **Template not initialized.** This project was created from `agile-project-template` and has not been kicked off yet. The only item that may be started is `TEC-001 — Kickoff` (run the `kickoff` skill); its initial backlog planning takes place on `main` before starting the item branch. Remove this notice during the kickoff.

## 0. Process

This project follows the shared process in [`docs/PROCESS.md`](docs/PROCESS.md). Read it before doing any work: it defines backlog, items, states, branches, commits, merges, `STATUS.md` updates, the Definition of Done and version closing.

This file contains only project-specific rules. Where it conflicts with `docs/PROCESS.md`, the process wins unless the deviation is listed in [Process overrides](#8-process-overrides).

At the start of every session read `STATUS.md`, then the relevant parts of `BACKLOG.md`.

## 1. Project

- **Name:** `<project-name>`
- **Summary:** `<one or two sentences: what the project does and for whom>`
- **Current version:** v0.1.0 — see `STATUS.md`.
- **Requirements:** `docs/REQUIREMENTS.md` · **Design:** `docs/TECHNICAL-DESIGN.md`

## 2. Language

- **Project language:** `<e.g. Italian>`
- Write project content (requirements, design, backlog text, status notes, README, CHANGELOG, commit descriptions, user-facing messages) in the project language, as defined in `docs/PROCESS.md` §2.
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

The quality gate used by the Definition of Done:

```bash
<install command>
<lint command>
<typecheck command>
<test command>
<build command>
```

Test guidelines: `<which test levels are expected (unit, integration, end-to-end) and any rule such as "do not mock the database to claim constraints are verified">`.

## 7. Definition of Done additions

In addition to `docs/PROCESS.md` §8:

- `<e.g. migrations are reproducible from a clean environment>`
- `<e.g. .env.example is updated when configuration changes>`

## 8. Process overrides

None.

## 9. Security and configuration

- Never commit secrets. Local configuration lives in `<e.g. .env>`, with a committed `<e.g. .env.example>` containing no real secrets.
- Do not log tokens, credentials or sensitive personal data.
- `<project-specific security rules>`
