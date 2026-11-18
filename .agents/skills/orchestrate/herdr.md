# Orchestrate: Herdr mode

Read by the `orchestrate` skill when it runs inside an hc terminal (`SKILL.md` §1). The sections below are applied where `SKILL.md` names them.

## Names

Each worker is an hc terminal named `<repo>-<id>`: `<id>` is the item ID in lowercase (`us-004`), `<repo>` the repository name (the last part of the origin URL without `.git`) in lowercase, with every character other than `a-z 0-9 - _` replaced by `-` and cut so that the whole name has at most 32 characters (`shop-api-us-004`). hc names allow only `a-z 0-9 - _` and must be unique among all live terminals of the machine: the repository part keeps workers of different projects with the same item ID apart. `<name>` below is that name; use the same one in every `hc` command for that worker.

## Status

- Agent status of a worker: `hc get <name>`.
- A worker whose terminal no longer exists: `hc get <name>` fails.
- A plan that was not received: `hc read <name> --lines 60`.

## Start

Report instruction for the task: `hc send <orchestrator address> "<ID> started|ready|done|blocked: <detail>"`, where the orchestrator address is `$HC_TERMINAL_ID`.

Start the worker with:

```bash
hc run --bg --json --no-parent --name <name> --label herdr.space=<space> \
  --cwd <Workspace root>/<ID> "$SHELL" -ic '"$@"' _ <worker command> "<task>"
```

- `<space>` is the `herdr.space` label of your own terminal (`hc get "$HC_TERMINAL_ID" --json`, `labels`). It gives the worker its own tab in the same Herdr space. If your terminal has no such label, omit `--label`: the worker runs without a tab and the user can follow it with `hc attach <name>`.
- `"$SHELL" -ic '"$@"' _` runs the worker command in the user's interactive shell, so it gets the same `PATH` and credentials as a terminal opened by hand. Without it, agents installed through version managers may fail to start or find no credentials.
- `--no-parent` makes the worker a top-level terminal: it keeps running when the orchestrator session ends, and Herdr shows its finished turns as `done` to the user. A child terminal of the orchestrator would go straight to `idle`, because hc treats a child's finished turn as news for its parent. Without a parent, hc types no notes about the worker into your terminal and `hc wait --children` does not see it: you follow workers through their reports and the checks of **Follow**.

Check the start: `hc wait <name> --timeout 60`, then `hc read <name> --lines 40`. If the agent shows a dialog (folder trust, login, …) or exited, tell the user and let them answer it in the worker's tab; send keys (`hc keys <name> …`) only with the user's agreement, except for the Claude Code folder trust dialog below.

- A Claude Code worker always stops on the folder trust dialog in a new clone ("Is this a project you created or one you trust?", `--dangerously-skip-permissions` does not skip it, and "No, exit" is preselected). The clone was just made by you from `origin`, so confirm it without asking: when the screen shows the dialog, select "Yes, I trust this folder" with `hc keys <name> down enter`, then read the screen again to check that the agent started on the task. If the screen shows anything else (another dialog, a different folder), do not send keys: tell the user. If the user asked to confirm the dialog themselves, leave it to them in each tab.

## Follow

Reports are interrupts, not something to wait for: do not run `hc wait`, sleep or poll. A worker's report arrives as a new input tagged `<hc from="…">` (`hc send` types it into your terminal once the user pauses). Workers have no parent (**Start**), so hc types no note when one blocks, errors or exits without reporting: the check below finds it. If a report arrives while you are doing something else, finish or pause that step, then handle the report.

- At the start of every turn, whatever the input, check your workers (`hc ls`, or `hc get <name>` for each): a worker that is `idle`, `done` or `blocked` without having sent its report probably asked a question in prose or forgot to report; read its screen (`hc read <name> --lines 40`) and tell the user. A worker launched through the shell wrapper may show `idle` at turn 0 before its first turn: that is not completion.
- Wait only when the user explicitly asks you to: `hc wait <name> --timeout 600` on a worker that is still working. It returns when that worker stops working, on a report from any worker (`reason: message`: the report arrives as your next input) or on `timeout` (a check-in: check your workers, then wait again only if the user still wants to wait).
- If the orchestrator session was restarted, workers keep running but their reports go to the old address. Find them with `hc ls` (names `<repo>-<id>`, **Names**) and tell each new address with `hc send <name> "From now on report to <new address>"`.
- Herdr's agents panel lists only terminals whose program reports a status. Some Claude Code versions stop reporting it during a session (`hc get "$HC_TERMINAL_ID" --json` shows `status: null` while you work), so the orchestrator disappears from the panel. Nothing else changes: reports still arrive through `hc send` and the checks above still work. If the user wants it back in the panel, tell them to quit you between turns and reopen the session with `claude --continue` in the same tab: the terminal, and so the address workers report to, stays the same.

## Send

`hc send <name> "<message>"`. The user can also type in the worker's tab directly.

## End

`hc kill <name>`, wait for it to finish (`hc wait <name> --timeout 30`), then `hc rm <name>`; its tab closes with it.
