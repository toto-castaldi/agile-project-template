# agile-project-template

Template repository for projects developed with coding agents (pi, Claude Code) following a simplified Scrum process: requirements, technical design, product backlog with versions, epics and items, one branch per item, a Definition of Done and versioned releases.

> This README describes the template. The `kickoff` skill replaces it with the presentation of the new project.

## Create a new project

1. On GitHub, **New repository → Start with a template → `toto-castaldi/agile-project-template`**, or:

   ```bash
   gh repo create <owner>/<name> --template toto-castaldi/agile-project-template --private --clone
   ```

2. Open the project with your coding agent and run the kickoff:
   - pi: `/skill:kickoff`
   - Claude Code: `/kickoff`

   The agent interviews you and fills requirements, technical design, backlog, status and `AGENTS.md` in branch `task/TEC-001-kickoff`.
3. Review the result and ask the agent to merge it (`merge-task`).

## What's inside

```text
AGENTS.md                  project-specific rules for agents (filled at kickoff)
CLAUDE.md                  imports AGENTS.md and docs/PROCESS.md for Claude Code
BACKLOG.md                 product backlog: versions, epics, items
STATUS.md                  short snapshot of the project, updated at every transition
CHANGELOG.md               changes per released version
docs/PROCESS.md            the shared process (identical in every project)
docs/REQUIREMENTS.md       the *what*: scope, actors, glossary, REQ-* requirements
docs/TECHNICAL-DESIGN.md   the *how*: numbered sections referenced by items
docs/adr/                  architecture decision records
docs/spikes/               spike reports
.agents/skills/            process skills (pi reads them natively)
.claude/skills             symlink to .agents/skills for Claude Code
```

## Skills

| Skill | When |
| --- | --- |
| `kickoff` | Initialize a new project (`TEC-001`) |
| `add-item` | New user story, task, spike or bug; requirement or scope change |
| `start-task` | Start an item: branch from `main`, `In Progress` |
| `finish-task` | Verify the Definition of Done and complete the item in its branch |
| `merge-task` | Merge into `main` (only on explicit request) |
| `close-version` | Close a version with CHANGELOG and tag (only on explicit request) |

## Process in a nutshell

- Item types: User Story `US-NNN`, Task `TEC-NNN`, Spike `SPIKE-NNN`, Bug `BUG-NNN`, grouped by thematic epics `EPIC-NNN`.
- States: `Todo`, `In Progress`, `Blocked`, `Done`. Priorities: `P0`, `P1`, `P2`. No sprints, no estimates.
- Branches: `us/`, `task/`, `spike/`, `fix/`, `backlog/`, `release/`. Merge `--no-ff` only on request.
- Commits: `type(ID): description` in the project language.
- Rules and structural labels in English; project content in the project language.

Full rules: [`docs/PROCESS.md`](docs/PROCESS.md).

## Updating the process in existing projects

`docs/PROCESS.md` and `.agents/skills/` are project-agnostic. To bring process improvements from the template into an existing project, copy them over in a `task/` item and check the `Process version` at the top of `docs/PROCESS.md`.
