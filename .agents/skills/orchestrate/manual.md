# Orchestrate: manual mode

Read by the `orchestrate` skill when neither Herdr nor Claude Code is available (`SKILL.md` §1). The user starts and follows the workers; the sections below are applied where `SKILL.md` names them.

## Status

The agent status of a worker is not known: read the state from its item branch (`SKILL.md` §2) and ask the user about its plan if it was not relayed.

## Start

Report instruction for the task: "tell the user". Print, for each item, the command for the user to run in a new terminal: `cd <Workspace root>/<ID> && <worker command> "<task>"`.

## Follow

Wait for the user to relay reports; read the state from the item branches (`SKILL.md` §2).

## Send

Tell the user what to type in the worker's terminal.

## End

Ask the user to close the worker's terminal.
