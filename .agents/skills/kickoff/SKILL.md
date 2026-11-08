---
name: kickoff
description: Initialize a project created from agile-project-template by interviewing the user and filling AGENTS.md, requirements, technical design, backlog and README (backlog item TEC-001). Use when the project still shows the "Template not initialized" notice or the user asks to kick off / start a new project.
---

# Kickoff (TEC-001)

Turn the template into a real project. The output is documentation only: no application code, no scaffold (the scaffold is a backlog item of its own).

Read `docs/PROCESS.md` and `AGENTS.md` first. Every rule there applies. `backlog` is `python3 .agents/tools/backlog.py`.

## 1. Preconditions

- `AGENTS.md` still contains the "Template not initialized" notice and `TEC-001` is `Todo` (`backlog show TEC-001`). If not, stop and tell the user the project has already been kicked off.
- Python 3.10 or newer is available (`python3 --version`). If not, stop and report it: the backlog CLI requires it.
- The current branch is `main` and the working tree is clean. If not, stop and ask the user to resolve the state without switching branches or discarding changes.
- If `main` has an upstream, run `git pull --ff-only` before planning; stop if it fails. Do not start the item branch until the initial items have been added on `main`.

## 2. Interview

Interview the user until you are aligned. Ask in short rounds of related questions (use a structured question tool if one is available), propose concrete options with a recommendation, and never invent answers: unknowns become open decisions or spikes.

1. **Language** — project language for content; language for code identifiers and comments. From now on, write content in the project language.
2. **Product** — project name, problem, target users/actors, what success looks like.
3. **Version v0.1.0** — goal, capabilities in scope, explicit out-of-scope items, release acceptance scenarios.
4. **Domain** — glossary terms, business rules and invariants that must never be violated.
5. **Non-functional** — reproducibility, security, privacy, performance, reliability, observability, anything mandatory.
6. **Technology** — language/runtime, frameworks, storage, integrations, architecture style and module boundaries, local runtime, deploy expectations (if any). Ask whether the project needs named modules for classifying items; if so, agree their IDs, names, responsibilities and known locations or boundaries. They need not be Git submodules.
7. **Quality gate** — commands for preparation, lint, typecheck, in-memory unit tests and build (they may not exist yet: record the intended commands and let the scaffold item create them); separate integration and end-to-end commands, prerequisites and when to run them.
8. **Parallel work** — whether several agents will work at the same time in separate clones or directories. If so, recommend shared claims `on` (`docs/PROCESS.md` §6.4: item branches are pushed at every state change; requires an `origin` remote); otherwise `off`. With shared claims `on`, ask whether one orchestrator agent should launch and follow the workers (`Parallel work` `on`, `docs/PROCESS.md` §6.5; otherwise `off`) and, if so, confirm or change `Workspace root` (default `../<repo-name>-work`) and `Worker agent command` (default `pi --approve`).
9. **Unknowns and risks** — anything to verify before designing: each becomes a `SPIKE-NNN`.
10. **Future** — ideas explicitly not in v0.1.0, for the unassigned backlog.

Before writing, summarize the understanding in a few bullets and get the user's confirmation.

## 3. Plan the initial backlog on main

- Agree on the initial epics, version scope and item list. Use the project language selected in the interview even though `AGENTS.md` is not filled yet.
- Add each new item on `main` using `add-item`: record its requirements first and include its related epics and design updates in that item's single commit. For an item assigned to a module, ensure that module is recorded in `docs/TECHNICAL-DESIGN.md` §3 before referencing it, adding it in the same commit if needed. Add other requirements alongside their respective items so that in-scope requirements remain covered. Keep the template notice until kickoff is completed. Do not create multiple items in one commit or start their implementation.
- Include all items needed for the agreed initial requirements, including `TEC-002` for the scaffold and any required spikes. Confirm scope changes with the user. If the plan changes later on the kickoff branch, preserve that work and return to a clean `main` with the user's agreement before using `add-item` again.
- Once planning is committed and `main` is clean, start `TEC-001` following `start-task`: create `task/TEC-001-kickoff`, mark it `In Progress` and commit the transition.

## 4. Write the documents

Write in the project language, keeping structural tokens in English (`docs/PROCESS.md` §2).

1. `docs/REQUIREMENTS.md` — goal, actors, glossary, scope in/out, functional areas and requirements with stable IDs (`REQ-<AREA>-NNN`), non-functional requirements (`REQ-NFR-NNN`), release acceptance of v0.1.0. State: `baseline`.
2. `docs/TECHNICAL-DESIGN.md` — initial architectural decisions with rationale, context, modules, conceptual data model if known, and the open decisions with the items that will close them. Preserve any module catalog recorded during planning and complete it as agreed; if the project has no named modules, no catalog is required. Leave sections not yet known short and explicit ("defined by TEC-00N").
3. `AGENTS.md` — fill every section, including §10 (`Shared claims` and `Parallel work` `on` or `off` from the interview, `Workspace root` with the repository name, `Worker agent command`), remove all `<placeholders>` and the "Template not initialized" notice. Keep it short: only project-specific rules.
4. Backlog (with the CLI):
   - set the goal of v0.1.0 with `backlog version edit v0.1.0 --goal …`;
   - define the epics (thematic containers, usually 3–8) with `backlog epic add`, and adjust `EPIC-001` with `backlog epic edit` if needed;
   - refine the items already added on `main` with `backlog edit`: type-specific fields, priority, dependencies, requirements or design references and verifiable acceptance criteria; retain optional module assignments and do not create new items on the kickoff branch;
   - every functional requirement in scope must be covered by at least one item;
   - record ideas outside v0.1.0 with `backlog ideas --add`, and replace the kickoff note with `backlog notes`.
5. `README.md` — replace the template description with a short presentation of the project (what it is, status, prerequisites and commands once they exist). No process rules.
6. `CHANGELOG.md` — keep the structure; add under `[Unreleased]` → `Added` a line for the project documentation baseline (`TEC-001`).
7. `.gitignore` — add the ignores of the chosen stack, keeping the existing ones.
8. Remove from the repository anything that only describes the template and is no longer true.

## 5. Close

Follow the `finish-task` procedure for `TEC-001`: verify acceptance criteria, mark it `Done` with its `outcome`, run `backlog check`, commit `docs(TEC-001): <description in project language>`.

Do not merge. Tell the user the kickoff is ready in `task/TEC-001-kickoff` and that it can be merged with `merge-task` on their request.
