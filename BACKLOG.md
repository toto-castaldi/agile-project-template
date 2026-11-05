# Product Backlog — `<project-name>`

## Management

- Process: `docs/PROCESS.md` (versions, epics, item types, fields, states, priorities, branches).
- Requirements: `docs/REQUIREMENTS.md` · Technical design: `docs/TECHNICAL-DESIGN.md`.
- `STATUS.md` is updated together with this file at every item or version transition.
- States: `Todo`, `In Progress`, `Blocked`, `Done`.
- Priorities: **P0** foundations/invariants, **P1** core functionality, **P2** completion and polish.
- Items may have an optional `Module` referring to a module in `docs/TECHNICAL-DESIGN.md` §3; modules are independent of epics.
- No Sprints, no time estimates.

## Version v0.1.0

**State:** Open

**Goal:** `<one or two sentences describing what v0.1.0 delivers; defined during the kickoff>`

### EPIC-001 — Project foundation

**Scope:** project initialization, scaffold, quality gate, local runtime and process tooling.

#### TEC-001 — Kickoff

- **Epic:** EPIC-001 — Project foundation
- **Type:** Task · **Priority:** P0 · **Status:** Todo
- **Dependencies:** none
- **Design references:** PROCESS §3, §4, §5; AGENTS (all sections)
- **Description:** Initialize the project from the template by interviewing the user. Run the `kickoff` skill.
- **Acceptance criteria:**
  - `AGENTS.md` is filled in (project, language, scope, stack, domain rules, quality gate, DoD additions) and the "template not initialized" notice is removed.
  - `docs/REQUIREMENTS.md` contains goal, actors, glossary, in/out of scope, first functional and non-functional requirements with stable IDs and the release acceptance criteria of v0.1.0.
  - `docs/TECHNICAL-DESIGN.md` contains the initial architectural decisions and the open decisions to be closed by backlog items.
  - `BACKLOG.md` contains the goal of v0.1.0, its epics and its items with dependencies, requirements and acceptance criteria; ideas outside v0.1.0 are in the unassigned backlog.
  - `README.md` presents the project instead of the template; `CHANGELOG.md` and `.gitignore` are adapted to the project.
  - `STATUS.md` is consistent with `BACKLOG.md`.

## Dependencies and suggested order

The order is not a time plan.

1. TEC-001.

## Unassigned backlog

Ideas not assigned to any version. They need requirements before they can be designed.

- `<idea>`
