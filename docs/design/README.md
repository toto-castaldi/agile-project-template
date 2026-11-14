# Technical design — `<project-name>`

**Target version:** v0.1.0

The *how* of the project, one file per topic (`docs/PROCESS.md` §5.2). Requirements are in `docs/requirements/`. Items reference a topic as `design/<topic>` (the file `docs/design/<topic>.md`). Topics grow with the items that introduce or change design choices; relevant decisions with meaningful alternatives go into `docs/adr/`. List the topics with `python3 .agents/tools/backlog.py docs`; read only the files you need.

Add a topic by copying `_TEMPLATE.md` to `<topic>.md` (lowercase kebab-case); split a topic that covers more than one subject.

## Initial architectural decisions

| Decision | Choice | Rationale |
| -------- | ------ | --------- |
| `<topic>` | `<choice>` | `<why>` |

## Open decisions

Decisions still to be closed and the backlog items that will close them:

- `<decision>` — `<item ID>`
