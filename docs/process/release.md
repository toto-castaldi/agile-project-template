# Process: release

Detailed rules of version closing, read before closing a version (`docs/PROCESS.md` §3). They are project-agnostic and must stay identical across projects.

## 1. Closing a version

- Only on explicit user request, and only when every item is `Done` or `Dropped`, the release acceptance criteria in `docs/requirements/acceptance.md` are satisfied, and the closing gate and all integration suites pass on an up-to-date `main`.
- The release is prepared in a `release/vX.Y.Z` branch, merged with `--no-ff` and tagged `vX.Y.Z`.
- Closing also compacts requirements and design (`docs/process/docs.md` §3): the scope and acceptance of the closed version are removed and the files changed during the version are condensed to the current state.

The procedure is in the `close-version` skill.
