# Process: requirements and design

Detailed rules of requirements, design, ADRs and spike reports, read when writing or changing them (`docs/PROCESS.md` §3). They are project-agnostic and must stay identical across projects.

## 1. Requirements

- `docs/requirements/README.md` holds the target version, goal, actors, scope in and out of the open version and the requirement areas; `glossary.md` the glossary; `acceptance.md` the release acceptance of the open version.
- One file per requirement, `docs/requirements/<ID>.md`, copied from `_TEMPLATE.md`: first line `# <ID> — <title>`, then `**State:** Active` or `**State:** Withdrawn`.
- IDs: functional `REQ-<AREA>-NNN`, non-functional `REQ-NFR-NNN`. IDs are stable and never reused; a removed requirement keeps its file, marked `Withdrawn` with the reason.

## 2. Technical design

- `docs/design/README.md` holds the target version, the initial architectural decisions and the open decisions with the items that will close them. Every other file is one topic, `docs/design/<topic>.md` in lowercase kebab-case, copied from `_TEMPLATE.md`, first line `# <title>`. The optional module catalog is `docs/design/modules.md`.
- A topic covers one subject; when it grows to cover more, split it and update the references of the open items.
- Use an ADR (`docs/adr/ADR-NNN-slug.md`) for decisions with relevant alternatives or long-term consequences. A spike report is `docs/spikes/SPIKE-NNN-slug.md` (`docs/PROCESS.md` §4.1).

## 3. Writing requirements and design

- They describe the current state of the product, not its history: when an item changes a requirement or a design choice, rewrite the text, do not append to it.
- No item IDs, dates, decision narratives or verification evidence in them, except the items that will close an open decision. History lives in the backlog (`remarks`, `outcome`, scope changes), in ADRs and in git.
- Scope and release acceptance hold only the open version: closing a version removes those of the closed one (`docs/process/release.md` §1).
