# agile-project-template

Template repository for projects developed with coding agents (pi, Claude Code) following a simplified Scrum process: requirements, technical design, product backlog with versions, epics and items, one branch per item, a Definition of Done and versioned releases.

> This README describes the template. The `kickoff` skill replaces it with the presentation of the new project.

## Prerequisites

Python 3.10 or newer, standard library only: the backlog lives in `backlog/` and is managed by `.agents/tools/backlog.py`.

## Create a new project

1. On GitHub, **New repository → Start with a template → `toto-castaldi/agile-project-template`**, or:

   ```bash
   gh repo create <owner>/<name> --template toto-castaldi/agile-project-template --private --clone
   ```

2. Open the project with your coding agent and run the kickoff:
   - pi: `/skill:kickoff`
   - Claude Code: `/kickoff`

   The agent interviews you, plans each initial backlog item on `main` in its own commit, and then completes the project documentation in branch `task/TEC-001-kickoff`.
3. Review the result and ask the agent to merge it (`merge-task`).

## What's inside

```text
AGENTS.md                  project-specific rules for agents (filled at kickoff)
CLAUDE.md                  imports AGENTS.md and docs/PROCESS.md for Claude Code
backlog/                   product backlog: versions, epics, items (one JSON file each), notes, ideas
CHANGELOG.md               changes per released version
docs/PROCESS.md            the shared process (identical in every project)
docs/PROCESS-PARALLEL.md   optional rules for shared claims and parallel work
docs/REQUIREMENTS.md       the *what*: scope, actors, glossary, REQ-* requirements
docs/TECHNICAL-DESIGN.md   the *how*: numbered sections referenced by items
docs/adr/                  architecture decision records
docs/spikes/               spike reports
.agents/skills/            process skills (pi reads them natively)
.agents/skills/backlog-overlay/  Claude Code plugin (backlog pane), not a skill
.agents/tools/backlog.py   CLI of the backlog: status, reading, state changes, check
.claude/skills             symlink to .agents/skills for Claude Code
.pi/extensions/            pi extensions (backlog overlay)
```

## Skills

| Skill | When |
| --- | --- |
| `kickoff` | Initialize a new project (`TEC-001`) |
| `add-item` | Add one new user story, task, spike or bug on `main` |
| `start-task` | Start an item: branch from `main`, `In Progress` |
| `finish-task` | Verify the Definition of Done and complete the item in its branch |
| `merge-task` | Merge into `main` (only on explicit request) |
| `close-version` | Close a version with CHANGELOG and tag (only on explicit request) |
| `orchestrate` | Run items in parallel through worker agents in separate clones (only on explicit request, with `Parallel work` on) |

## Backlog overlay in pi

`.pi/extensions/backlog/` adds a read-only overlay that shows the items of the backlog one at a time, without leaving the pi conversation.

- Open it with `ctrl+shift+b`, or with `/backlog` in terminals that do not distinguish `ctrl+shift` combinations.
- To change the shortcut (for example when it conflicts with the terminal or a multiplexer), set it in pi's `settings.json`, globally (`~/.pi/agent/settings.json`) or per project (`.pi/settings.json`, which overrides the global one), then restart pi or run `/reload`:

  ```json
  { "backlogOverlay": { "shortcut": "ctrl+alt+b" } }
  ```

  Use `false` to disable the shortcut and keep only `/backlog`. Choose a key that `/hotkeys` does not list, or pi warns about the conflict.
- `←`/`→` (or `↑`/`↓`) move to the previous/next item across epics and versions, `Home`/`End` to the first/last one, `PgUp`/`PgDn` scroll a long item, `Esc` or `q` closes it.
- `t`, `p` and `s` cycle the Type (`all`, `User Story`, `Task`, `Spike`, `Bug`), Priority (`all`, `P0`, `P1`, `P2`) and Status (`all`, `Todo`, `In Progress`, `Blocked`, `Done`, `Dropped`) filters; `T`, `P` and `S` cycle backwards. Navigation visits only the items that match all three, and the header shows the position among them and the total, for example `2 / 5 (12 total)`.
- The filters start as `Type: all · Priority: all · Status: Todo` and are kept for the rest of the pi session; restarting pi or running `/reload` resets them. They are never saved to disk.
- States come from item branches too, so parallel agents in different clones or directories see what the others have started. The overlay asks the backlog CLI (`export --json --branches`), which applies the rules of `docs/PROCESS-PARALLEL.md` §1: each item is shown as it is on its unmerged item branch, local or remote-tracking; a local branch wins over the remote-tracking one with the same name, and on an item branch its own item keeps the working-tree copy. Items that exist only in a branch are not shown.
- At every opening, inside a git repository with a remote, the overlay opens at once with the current directory, then shows the states from the local refs, then `fetching…` while the CLI runs `git fetch --prune` (10 s timeout), and updates when the fetch completes, keeping the current item and the filters. If the fetch fails it shows `fetch failed: showing last known state`.
- The header shows `from <ref>` when an item comes from a branch, and `also in: <refs>` when more than one unmerged branch carries it (the one with the most recent commit is shown). Filters apply to these resolved states.
- It never modifies files: state changes stay with the skills. The fetch updates only git refs.
- pi loads project extensions only after the project is trusted. Projects that do not use pi can delete `.pi/extensions/`.

## Backlog pane in Claude Code

`.agents/skills/backlog-overlay/` is a Claude Code plugin with the same read-only view of the backlog, in a pane beside the conversation. Claude Code (2.1.287 or newer) loads it by itself through the `.claude/skills` symlink once the folder is trusted, when Claude Code is started from the root of the repository; there is nothing to install. After trusting the folder in a running session, run `/reload-plugins`.

- Open it with `/backlog`, also while the agent is working. The pane takes the keyboard; `ctrl+x tab` gives it back to the pane later, `Esc` or `q` closes it.
- `n`/`b` move to the next/previous item across epics and versions, `g`/`e` to the first/last one, the arrows scroll a long item.
- `t`, `p` and `s` cycle the Type, Priority and Status filters, with the same values and defaults as the pi overlay; `x` resets them. They are kept for the rest of the Claude Code session.
- `r` reads the backlog and the item branches again; `/backlog` on an open pane does the same.
- States from item branches, `from <ref>`, `also in: <refs>`, `fetching…` and `fetch failed: showing last known state` work as in the pi overlay: both render the same `backlog export --json --branches` (`docs/PROCESS-PARALLEL.md` §1).
- It never modifies files; the fetch updates only git refs. Claude Code may write type declarations for editors into the plugin's `.claude-plugin/types/` when it loads it; `.gitignore` excludes them.
- It is a plugin, not a skill: it has no `SKILL.md` and must never get one, so that pi and Claude Code do not list it as a skill. Projects that do not use Claude Code can delete the folder.

## Process in a nutshell

- Item types: User Story `US-NNN`, Task `TEC-NNN`, Spike `SPIKE-NNN`, Bug `BUG-NNN`, grouped by thematic epics `EPIC-NNN`. Items may also reference an optional project module `MOD-NNN` defined in the technical design; modules need not be Git submodules.
- States: `Todo`, `In Progress`, `Blocked`, `Done`, `Dropped`. Priorities: `P0`, `P1`, `P2`. No sprints, no estimates.
- The status of the project is computed on request (`python3 .agents/tools/backlog.py status`); agents read and change the backlog only through that CLI.
- Add each new backlog item directly on a clean, up-to-date `main` in one documentation-only commit, pushed at once when `main` has an upstream; no branch or merge for the addition.
- Develop items on `us/`, `task/`, `spike/` or `fix/` branches; use `backlog/` for other grooming and `release/` for releases. Merge `--no-ff` only on request.
- Optional shared claims (`AGENTS.md` §10): for agents working in parallel clones, item branches are pushed at every state change and an item that already has a branch is not started again. `main` is pushed automatically only when an item is added.
- Optional parallel work (`AGENTS.md` §10, requires shared claims): an orchestrator agent on `main` launches one worker agent per item, each in its own clone; each worker claims its item, proposes a plan and waits for your go. The orchestrator follows their reports without blocking, so you can keep planning with it while workers implement; it merges on request and removes merged clones. It uses Herdr (`hc`) when available, otherwise it prints the commands to start the workers.
- Commits: `type(ID): description` in the project language.
- Rules and structural labels in English; project content in the project language.

Full rules: [`docs/PROCESS.md`](docs/PROCESS.md).

## Updating the process in existing projects

To move a project from `BACKLOG.md` and `STATUS.md` to `backlog/` (template 2.0.0 and later): merge or finish open item branches, copy the project-agnostic files, then run `python3 .agents/tools/backlog.py import-md --dry-run` and, once it reports no problems, again without `--dry-run`. It never guesses: lines it cannot read are listed with their location and nothing is written. Fields the new format does not have are kept as `remarks`; with `--skip-unrecognized` the unreadable lines are left out and listed, to be recorded by hand if still useful.

`docs/PROCESS.md`, `docs/PROCESS-PARALLEL.md`, `.agents/skills/`, `.agents/tools/` and `.gitattributes` are project-agnostic. To bring process improvements from the template into an existing project, copy them over in a `task/` item and check the `Process version` at the top of `docs/PROCESS.md`. The pi extensions in `.pi/extensions/` are project-agnostic too and can be copied the same way, together with the `.pi/*` / `!.pi/extensions/` rules of `.gitignore`; so is the Claude Code backlog pane in `.agents/skills/backlog-overlay/`, with the `.claude-plugin/types/` rule of `.gitignore`. Projects that use modules can then document them in `docs/TECHNICAL-DESIGN.md` §3 and assign them to items; existing projects without modules need no module catalog. To adopt shared claims, add `## 10. Parallel work` with `` - **Shared claims:** `on` `` to the project's `AGENTS.md`; without that section they stay off. To adopt parallel work as well, add `` - **Parallel work:** `on` `` (and optionally `Workspace root` and `Worker agent command`) to the same section; without it, parallel work stays off. Workers run unattended: if the project sets `Worker agent command` to plain `pi`, change it to `pi --approve`, or each worker stops on the folder trust dialog.
