# Orchestrate: Claude Code mode

Read by the `orchestrate` skill when it runs inside Claude Code without Herdr (`SKILL.md` §1). Workers are headless Claude Code sessions (`claude -p`), one turn at a time, run as background commands. The sections below are applied where `SKILL.md` names them.

## Status

- Agent status of a worker: `working` if a turn is running (`pgrep -f <session id>`, see **Start**), otherwise `idle`.
- A worker whose agent no longer exists: its clone has no `.git/orchestrate-session` file.
- A plan that was not received: `tail -n 60 <clone>/.git/orchestrate.log`.

## Start

Report instruction for the task: "end your turn with a message whose last line is `<ID> started|ready|done|blocked: <detail>`".

For each worker:

1. Create its session id and keep it in the clone, outside the working tree: `python3 -c 'import uuid; print(uuid.uuid4())' > <Workspace root>/<ID>/.git/orchestrate-session`.
2. Run its first turn with the Bash tool **in the background** (`run_in_background`), one background command per worker, all of them in the same response so they start together:

   ```bash
   set -o pipefail; cd <Workspace root>/<ID> && \
     claude -p --dangerously-skip-permissions --session-id <session id> "<task>" 2>&1 \
     | tee -a .git/orchestrate.log
   ```

- `claude -p` runs one turn without a terminal: there is no folder trust dialog to answer and no tab to watch. The worker stops when its turn ends, so a `ready` report is its final message and the harness notifies you when the background command exits; the go resumes the same conversation (**Send**). A worker that reports `started` goes on implementing in the same turn: the `started` line appears in its log, and its final message is the `done` or `blocked` report.
- The output of every turn is appended to `.git/orchestrate.log` in the clone: read it with `tail -n 60 <clone>/.git/orchestrate.log`.

Check the start: do not wait. A worker that cannot start (login, unknown option, …) exits at once and its background command reports the error; tell the user.

## Follow

Reports arrive as the completion notifications of the workers' background commands: do not read the output of a command that is still running. On a notification, read the worker's final message (the end of the command output, or `tail -n 60 <clone>/.git/orchestrate.log`). Its last line is the report; if there is none, the worker asked a question in prose, stopped early or failed (non-zero exit): tell the user.

- Background commands may end with your session. If the orchestrator session was restarted, find the workers from the clones under `Workspace root` that have `.git/orchestrate-session`. A worker with no running turn (`pgrep -f <session id>` finds nothing) whose last turn ended without a report was probably interrupted: read its log and the branch, and resume it only with the user's agreement ("Continue <ID> where you stopped.").

## Send

Start a new turn of the worker in the background: the command of **Start** step 2 with `--resume <session id>` instead of `--session-id <session id>` and the message instead of the task. With several workers, one background command per worker, all of them in the same response. Never start a turn for a worker whose turn is still running (`pgrep -f <session id>` finds it): one turn at a time per worker.

The user can open a worker's conversation, when no turn is running, with `cd <clone> && claude --resume <session id> --dangerously-skip-permissions` (Claude Code asks once to trust the clone).

## End

If a turn is still running (`pgrep -f <session id>`), stop its background command. Nothing else stays open, and the conversation remains in the Claude Code history.
