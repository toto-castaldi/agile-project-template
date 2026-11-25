# Process: backlog

Detailed rules of the backlog, read when changing versions, epics or item fields (`docs/PROCESS.md` §3). They extend `docs/PROCESS.md` §4, are project-agnostic and must stay identical across projects.

## 1. Versions

- Semantic Versioning, starting at `v0.1.0`. States: `Planned`, `Open`, `Closed`. Only one version is `Open`, unless a patch version is opened to fix bugs in a closed one.
- All items assigned to a version are required for it, regardless of priority.
- Changing the scope of an open version must be agreed with the user and recorded in `backlog/` (`backlog version edit --scope-change`).
- Ideas not assigned to a version are recorded with `backlog ideas --add`, one line each, without an ID. An item with full fields may stay without a version (`backlog add --unassigned`): it is never ready and cannot start until it has one. Both need requirements before they can be designed, and an item needs acceptance criteria before it gets a version.

## 2. Epics

Thematic containers (`EPIC-001`) with a title and a scope. No state, acceptance criteria, branch or progress; they may span versions.

## 3. Item fields

`backlog --help` gives the syntax of every command in one call, `backlog <command> --help` explains its options and `backlog show` the fields of an item; the CLI rejects invalid records.

- Every User Story and Bug assigned to a version references at least one requirement. Technical items reference the design or process sections they produce or change.
- `requirements` lists requirement IDs, each the file `docs/requirements/<ID>.md`. `design_references` lists:
  - design topics as `design/<topic>` (the file `docs/design/<topic>.md`) and other files of `docs/requirements/` as `requirements/<name>`;
  - ADRs as `ADR-NNN`;
  - sections of the process as `PROCESS §N` (`docs/PROCESS.md`), `process/<name>` or `process/<name> §N` (`docs/process/<name>.md`), and sections of `AGENTS.md` as `AGENTS §N`.

  `backlog check` rejects a `design/`, `requirements/` or `process/` reference whose file does not exist, a `PROCESS §N` or `process/<name> §N` whose section does not exist, and an open item that references a `Withdrawn` requirement.
- Acceptance criteria are concrete and verifiable. Avoid wording such as "works well".
- `remarks` holds information that fits no other field, such as a later decision about the item.
- `module` is optional and independent of the epic; it need not be a Git submodule. Do not invent one: it must be in `docs/design/modules.md`, with a stable ID (`MOD-001`), sequential and never reused, a name, a responsibility and its location when known.

## 4. Project status

The status is computed from `backlog/` and never stored: `backlog status` gives a summary whose size does not grow with the backlog, `list`, `ready` and `show` the rest, and `export` everything as Markdown for a human.

Notes (`backlog notes`) are at most a few lines of cross-cutting information. Per-item details belong in the item's `outcome`.

`backlog check` validates the store.

## 5. Item branches across clones

`--branches` (on `status`, `list`, `ready`, `show` and `export`) is the cross-clone view of shared claims (`docs/PROCESS-PARALLEL.md` §1): it runs `git fetch --prune origin` (10 s timeout; `--no-fetch` skips it) and shows each item as it is on its item branch. Without the option, the backlog reflects only the current checkout. The rules:

- item branches are the local and remote-tracking branches named `<prefix><ID>-…` (`docs/PROCESS.md` §5.1) that are not merged into local `main` or into a remote's default branch;
- a local branch wins over the remote-tracking branch with the same name;
- on an item branch, its own item keeps the working-tree copy;
- with several branches for one ID, the one with the most recent commit wins; `show` lists it with the others, `export --json` gives them under `branches`;
- items that exist only in a branch are not shown;
- a failed fetch is only a warning: the last fetched refs are used.
