# Process: git

Detailed rules of item additions, grooming branches and merges, read before doing them (`docs/PROCESS.md` §3). They extend `docs/PROCESS.md` §5, are project-agnostic and must stay identical across projects.

## 1. Adding items

- A new item of any type is added only on a clean, up-to-date `main`, with `git pull --ff-only` when an upstream exists. If that is not the state, stop and ask the user; do not switch branches, stash or discard changes.
- Each addition is exactly one documentation-only `docs(<ID>)` commit directly on `main`, with the new item and its requirements and design updates. No branch or merge. If `main` has an upstream, it must have no other unpushed commits before the addition, and the commit is pushed at once so that every clone sees it (procedure in `add-item`). This is the only automatic push of `main`.
- If an item branch reveals a new dependency, do not add that item there: preserve the work and ask the user to return to a clean `main`.

## 2. Other branches

Other backlog grooming uses a `backlog/<short-slug>` branch, merged like an item branch, with commit type `docs` and the main item touched as scope. Release branches are `release/vX.Y.Z` (`docs/process/release.md`).

## 3. Merge

- Merging into `main` is **never automatic**: leave the work committed in the item branch and wait for an explicit user request before merging or pushing to `main`.
- The closing gate (`docs/PROCESS.md` §6) passes on `main` before the merge is pushed.
- `git merge --no-ff` with message `merge(<ID>): <item title>`.
- The merge commit contains only the merge and its conflict resolution. Fix errors on the branch first.
- If a record in `backlog/` conflicts, keep both sides' changes in that file, or the lines of both sides in `NOTES.md` and `IDEAS.md`, then run `backlog check`.
- After a successful merge and push, delete the local and remote branch after verifying it is merged. Never delete unmerged branches, except when releasing a claimed item that was never started (`docs/PROCESS-PARALLEL.md` §2).
