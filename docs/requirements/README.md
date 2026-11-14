# Requirements — `<project-name>`

**Target version:** v0.1.0

**State:** `<draft | baseline>`

The *what* of the project, one file per requirement (`docs/PROCESS.md` §5.1). The *how* is in `docs/design/`. Every change of scope or behavior is recorded here before updating backlog and implementation (`docs/PROCESS.md` §3, §5). List the requirements with `python3 .agents/tools/backlog.py docs`; read only the files you need.

| File | Content |
| --- | --- |
| `README.md` | goal, actors, scope of the open version, requirement areas |
| `glossary.md` | terms used in requirements, backlog and code |
| `acceptance.md` | release acceptance of the open version |
| `REQ-<AREA>-NNN.md` | one requirement; copy `_TEMPLATE.md` |

## Goal

`<What problem the project solves, for whom, and what success looks like for v0.1.0.>`

## Actors

- **`<Actor>`:** `<who they are, what they can do>`

## Scope

### In scope for v0.1.0

- `<capability>`

### Out of scope for v0.1.0

Do not introduce these without first updating the requirements and the backlog:

- `<excluded capability>`

## Areas

Functional requirement IDs: `REQ-<AREA>-NNN`; non-functional: `REQ-NFR-NNN`. Areas used in this project:

| Area | Meaning |
| ---- | ------- |
| `<AREA>` | `<functional area>` |
| `NFR` | non-functional requirements |
