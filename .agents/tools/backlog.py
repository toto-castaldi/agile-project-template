#!/usr/bin/env python3
"""Project-agnostic CLI for the backlog store in `backlog/`.

The store holds one JSON file per record, so parallel branches touch different
files. This tool is the only way to read and write it. Python 3.10+, standard
library only.

Exit codes: 0 success, 1 refused operation or failed check, 2 wrong usage.
"""
from __future__ import annotations

import argparse
import datetime
import json
import os
import re
import subprocess
import sys
import tempfile
from pathlib import Path

if sys.version_info < (3, 10):
    sys.exit("backlog.py requires Python 3.10 or newer.")

TYPES = {
    "US": ("User Story", "us/"),
    "TEC": ("Task", "task/"),
    "SPIKE": ("Spike", "spike/"),
    "BUG": ("Bug", "fix/"),
}
TYPE_BY_NAME = {name: prefix for prefix, (name, _) in TYPES.items()}
STATES = ("Todo", "In Progress", "Blocked", "Done", "Dropped")
PRIORITIES = ("P0", "P1", "P2")
VERSION_STATES = ("Planned", "Open", "Closed")

ITEM_FIELDS = (
    "id", "title", "version", "epic", "module", "type", "priority", "status",
    "branch", "dependencies", "dependency_override", "requirements",
    "design_references", "description", "found_in", "steps_to_reproduce",
    "expected", "actual", "acceptance_criteria", "remarks", "blocked_by", "outcome",
    "closed_at",
)
ITEM_REQUIRED = (
    "id", "title", "epic", "type", "priority", "status",
    "dependencies", "acceptance_criteria",
)
ITEM_LISTS = ("dependencies", "requirements", "design_references", "acceptance_criteria", "remarks", "scope_changes")
VERSION_FIELDS = ("id", "goal", "state", "closed_at", "scope_changes")
VERSION_REQUIRED = ("id", "goal", "state")
EPIC_FIELDS = ("id", "title", "scope")
EPIC_REQUIRED = ("id", "title", "scope")

ITEM_ID = re.compile(r"^(US|TEC|SPIKE|BUG)-(\d{3,})$")
EPIC_ID = re.compile(r"^EPIC-\d{3,}$")
MODULE_ID = re.compile(r"^MOD-\d{3,}$")
VERSION_ID = re.compile(r"^v(\d+)\.(\d+)\.(\d+)$")
REQUIREMENT_ID = re.compile(r"^REQ-[A-Z0-9]+-\d+$")
REQUIREMENT_IN_TEXT = re.compile(r"\bREQ-[A-Z0-9]+-\d+\b")
SCOPE_CHANGE_LINE = re.compile(r"^\*\*Scope change \((\d{4}-\d{2}-\d{2})\):\*\*\s*(.+)$")
DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
SLUG = r"[a-z0-9]+(?:-[a-z0-9]+)*"

SECTION_LIMIT = 10
NOTES_LIMIT = 5
TEXT_LIMIT = 80
DEFAULT_LIST_LIMIT = 30


class BacklogError(Exception):
    """An operation was refused; the message is shown to the user."""


def today() -> str:
    return datetime.date.today().isoformat()


def item_key(item_id: str) -> tuple:
    match = ITEM_ID.match(item_id)
    if not match:
        return (len(TYPES), 0, item_id)
    return (list(TYPES).index(match[1]), int(match[2]), item_id)


def version_key(version_id: str) -> tuple:
    match = VERSION_ID.match(version_id)
    return tuple(int(part) for part in match.groups()) if match else (-1, -1, -1)


def ready_key(item: dict) -> tuple:
    return (item.get("priority", "P9"), item_key(item["id"]))


def shorten(text: str, limit: int = TEXT_LIMIT) -> str:
    line = " ".join(str(text).split())
    return line if len(line) <= limit else line[: limit - 1].rstrip() + "…"


def serialize(record: dict, fields: tuple, required: tuple) -> str:
    """Canonical text of a record: fixed key order, empty optional fields left out."""
    ordered = {}
    for field in fields:
        value = record.get(field)
        if field in required or value not in (None, "", []):
            ordered[field] = value
    return json.dumps(ordered, indent=2, ensure_ascii=False) + "\n"


class Store:
    KINDS = {
        "items": (ITEM_FIELDS, ITEM_REQUIRED),
        "versions": (VERSION_FIELDS, VERSION_REQUIRED),
        "epics": (EPIC_FIELDS, EPIC_REQUIRED),
    }

    def __init__(self, root: Path):
        self.root = root
        self.base = root / "backlog"
        self.items: dict[str, dict] = {}
        self.versions: dict[str, dict] = {}
        self.epics: dict[str, dict] = {}
        self.load_errors: list[tuple[str, str]] = []
        self.non_canonical: set[str] = set()
        self.branch_sources: dict[str, dict] = {}
        self.remotes: list[str] = []
        for kind in self.KINDS:
            self._load(kind)

    def _load(self, kind: str) -> None:
        fields, required = self.KINDS[kind]
        records = getattr(self, kind)
        for path in sorted((self.base / kind).glob("*.json")):
            try:
                text = path.read_text(encoding="utf-8")
                data = json.loads(text)
            except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
                self.load_errors.append((path.stem, f"cannot read {path.name}: {error}"))
                continue
            if not isinstance(data, dict):
                self.load_errors.append((path.stem, f"{path.name} is not a JSON object"))
                continue
            if data.get("id") != path.stem:
                self.load_errors.append((path.stem, f"id {data.get('id')!r} does not match the file name"))
                continue
            records[path.stem] = data
            if set(data) <= set(fields) and text != serialize(data, fields, required):
                self.non_canonical.add(path.stem)

    def require_loaded(self) -> None:
        if self.load_errors:
            details = "; ".join(f"{where}: {message}" for where, message in self.load_errors)
            raise BacklogError(f"the backlog store cannot be read: {details}")

    def write(self, kind: str, record: dict) -> None:
        fields, required = self.KINDS[kind]
        path = self.base / kind / f"{record['id']}.json"
        write_atomic(path, serialize(record, fields, required))

    def item(self, item_id: str) -> dict:
        if item_id not in self.items:
            raise BacklogError(f"item {item_id} not found")
        return self.items[item_id]

    def open_versions(self) -> list[dict]:
        found = [v for v in self.versions.values() if v.get("state") == "Open"]
        return sorted(found, key=lambda v: version_key(v["id"]))

    def next_id(self, prefix: str) -> str:
        numbers = [int(m[2]) for m in map(ITEM_ID.match, self.items) if m and m[1] == prefix]
        # An imported idea may already carry an ID: never hand it out again.
        ideas = self.base / "IDEAS.md"
        if ideas.exists():
            numbers += [int(n) for n in re.findall(rf"\b{prefix}-(\d{{3,}})\b", ideas.read_text(encoding="utf-8"))]
        return f"{prefix}-{max(numbers, default=0) + 1:03d}"

    def next_epic_id(self) -> str:
        numbers = [int(e.split("-")[1]) for e in self.epics if EPIC_ID.match(e)]
        return f"EPIC-{max(numbers, default=0) + 1:03d}"

    def ready(self) -> list[dict]:
        open_ids = {v["id"] for v in self.open_versions()}
        found = [
            i for i in self.items.values()
            if i.get("status") == "Todo" and i.get("version") in open_ids
            and all(self.items.get(d, {}).get("status") == "Done" for d in i.get("dependencies", []))
        ]
        return sorted(found, key=ready_key)

    def done(self) -> list[dict]:
        found = [i for i in self.items.values() if i.get("status") == "Done"]
        found.sort(key=lambda i: item_key(i["id"]), reverse=True)
        found.sort(key=lambda i: str(i.get("closed_at", "")), reverse=True)
        return found


def write_atomic(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temp = tempfile.mkstemp(dir=path.parent, prefix=f".{path.name}.")
    try:
        with os.fdopen(handle, "w", encoding="utf-8", newline="\n") as out:
            out.write(text)
        os.chmod(temp, 0o644)
        os.replace(temp, path)
    except BaseException:
        Path(temp).unlink(missing_ok=True)
        raise


# --- Validation -------------------------------------------------------------


def check_fields(where, record, fields, required, errors) -> bool:
    unknown = sorted(set(record) - set(fields))
    for field in unknown:
        errors.append((where, f"unknown field {field!r}"))
    for field in required:
        if record.get(field) in (None, "") and field not in ITEM_LISTS:
            errors.append((where, f"missing field {field!r}"))
    return not unknown


def check_string_fields(where, record, errors) -> None:
    for field, value in record.items():
        if field in ITEM_LISTS:
            if not isinstance(value, list) or not all(isinstance(v, str) and v.strip() for v in value):
                errors.append((where, f"{field} must be a list of non-empty strings"))
        elif value is not None and not isinstance(value, str):
            errors.append((where, f"{field} must be a string"))


def check_date(where, record, field, errors) -> None:
    value = record.get(field)
    if value in (None, ""):
        return
    try:
        if not DATE.match(str(value)):
            raise ValueError
        datetime.date.fromisoformat(value)
    except ValueError:
        errors.append((where, f"{field} must be a date YYYY-MM-DD"))


def check_versions(store: Store, errors) -> None:
    for vid, version in store.versions.items():
        check_fields(vid, version, VERSION_FIELDS, VERSION_REQUIRED, errors)
        check_string_fields(vid, version, errors)
        if not VERSION_ID.match(vid):
            errors.append((vid, "version id must be vMAJOR.MINOR.PATCH"))
        state = version.get("state")
        if state not in VERSION_STATES:
            errors.append((vid, f"invalid state {state!r}"))
        check_date(vid, version, "closed_at", errors)
        if state == "Closed" and not version.get("closed_at"):
            errors.append((vid, "Closed without closed_at"))
        if state != "Closed" and version.get("closed_at"):
            errors.append((vid, f"{state} with closed_at"))
    regular = [v["id"] for v in store.open_versions() if version_key(v["id"])[2] == 0]
    for vid in regular[1:]:
        errors.append((vid, f"more than one open version: {', '.join(regular)}"))


def check_epics(store: Store, errors) -> None:
    for eid, epic in store.epics.items():
        check_fields(eid, epic, EPIC_FIELDS, EPIC_REQUIRED, errors)
        check_string_fields(eid, epic, errors)
        if not EPIC_ID.match(eid):
            errors.append((eid, "epic id must be EPIC-NNN"))


def read_doc(root: Path, relative: str) -> str | None:
    try:
        return (root / relative).read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return None


def check_item(store: Store, iid: str, item: dict, docs: dict, errors) -> None:
    check_fields(iid, item, ITEM_FIELDS, ITEM_REQUIRED, errors)
    check_string_fields(iid, item, errors)
    match = ITEM_ID.match(iid)
    if not match:
        errors.append((iid, "item id must be US-NNN, TEC-NNN, SPIKE-NNN or BUG-NNN"))
        return
    prefix = match[1]
    if item.get("type") != TYPES[prefix][0]:
        errors.append((iid, f"type must be {TYPES[prefix][0]!r}"))
    if item.get("priority") not in PRIORITIES:
        errors.append((iid, f"invalid priority {item.get('priority')!r}"))
    if not item.get("acceptance_criteria") and item.get("version"):
        errors.append((iid, "acceptance_criteria is empty"))
    version_id = item.get("version")
    if version_id not in (None, "") and version_id not in store.versions:
        errors.append((iid, f"unknown version {version_id!r}"))
    if item.get("epic") not in store.epics:
        errors.append((iid, f"unknown epic {item.get('epic')!r}"))
    check_module(iid, item, docs, errors)
    check_requirements(iid, item, prefix, docs, errors)
    if prefix == "BUG":
        for field in ("found_in", "steps_to_reproduce", "expected", "actual"):
            if not item.get(field):
                errors.append((iid, f"a Bug needs {field}"))
    check_status(store, iid, item, prefix, errors)
    check_dependencies(store, iid, item, errors)


def check_module(iid, item, docs, errors) -> None:
    module = item.get("module")
    if module in (None, ""):
        return
    if not MODULE_ID.match(str(module)):
        errors.append((iid, f"invalid module {module!r}: use MOD-NNN"))
    elif docs["design"] is not None and str(module) not in docs["design"]:
        errors.append((iid, f"module {module} is not in docs/TECHNICAL-DESIGN.md"))


def check_requirements(iid, item, prefix, docs, errors) -> None:
    requirements = item.get("requirements") or []
    if prefix in ("US", "BUG") and not requirements and item.get("version"):
        errors.append((iid, "a User Story or Bug needs at least one requirement"))
    if not isinstance(requirements, list):
        return
    for requirement in requirements:
        if not REQUIREMENT_ID.match(str(requirement)):
            errors.append((iid, f"invalid requirement {requirement!r}: use REQ-<AREA>-NNN"))
        elif docs["requirements"] is not None and str(requirement) not in docs["requirements"]:
            errors.append((iid, f"requirement {requirement} is not in docs/REQUIREMENTS.md"))


def check_status(store, iid, item, prefix, errors) -> None:
    status = item.get("status")
    if status not in STATES:
        errors.append((iid, f"invalid status {status!r}"))
    branch = item.get("branch")
    if branch and not re.fullmatch(f"{TYPES[prefix][1]}{iid}-{SLUG}", str(branch)):
        errors.append((iid, f"invalid branch {branch!r}: expected {TYPES[prefix][1]}{iid}-<short-slug>"))
    if status == "In Progress" and not branch:
        errors.append((iid, "In Progress without branch"))
    if status == "Blocked" and not item.get("blocked_by"):
        errors.append((iid, "Blocked without blocked_by"))
    if status != "Blocked" and item.get("blocked_by"):
        errors.append((iid, f"{status} with blocked_by"))
    check_date(iid, item, "closed_at", errors)
    if status in ("Done", "Dropped"):
        if not item.get("outcome"):
            errors.append((iid, f"{status} without outcome"))
        if not item.get("closed_at"):
            errors.append((iid, f"{status} without closed_at"))
    else:
        if item.get("outcome") or item.get("closed_at"):
            errors.append((iid, f"{status} with outcome or closed_at"))
        if store.versions.get(item.get("version"), {}).get("state") == "Closed":
            errors.append((iid, f"{status} in closed version {item.get('version')}"))


def check_dependencies(store, iid, item, errors) -> None:
    dependencies = item.get("dependencies")
    if not isinstance(dependencies, list):
        return
    for dependency in dependencies:
        target = store.items.get(dependency)
        if target is None:
            errors.append((iid, f"unknown dependency {dependency!r}"))
        elif target.get("status") == "Dropped" and item.get("status") not in ("Done", "Dropped"):
            errors.append((iid, f"depends on dropped item {dependency}"))
    if reaches(store, iid, iid):
        errors.append((iid, "dependency cycle"))


def reaches(store: Store, start: str, goal: str) -> bool:
    seen = set()
    stack = list(_dependencies(store, start))
    while stack:
        current = stack.pop()
        if current == goal:
            return True
        if current not in seen:
            seen.add(current)
            stack.extend(_dependencies(store, current))
    return False


def _dependencies(store: Store, item_id: str) -> list:
    dependencies = store.items.get(item_id, {}).get("dependencies")
    return [d for d in dependencies if isinstance(d, str)] if isinstance(dependencies, list) else []


def validate(store: Store) -> list[tuple[str, str]]:
    errors = list(store.load_errors)
    check_versions(store, errors)
    check_epics(store, errors)
    docs = {
        "design": read_doc(store.root, "docs/TECHNICAL-DESIGN.md"),
        "requirements": read_doc(store.root, "docs/REQUIREMENTS.md"),
    }
    for iid, item in sorted(store.items.items(), key=lambda pair: item_key(pair[0])):
        check_item(store, iid, item, docs, errors)
    for where in sorted(store.non_canonical):
        errors.append((where, "file is not in canonical format: it was edited outside the CLI"))
    return errors


def save(store: Store, kind: str, record: dict) -> None:
    """Write a record only if it is valid in the store it would become part of."""
    getattr(store, kind)[record["id"]] = record
    errors = [message for where, message in validate(store) if where == record["id"]]
    errors = [m for m in errors if "canonical format" not in m]
    if errors:
        raise BacklogError(f"{record['id']}: " + "; ".join(errors))
    store.write(kind, record)
    store.non_canonical.discard(record["id"])


# --- Branch overlay ---------------------------------------------------------


GIT_TIMEOUT = 10
ITEM_BRANCH = re.compile(r"^(?:us|task|spike|fix)/((?:US|TEC|SPIKE|BUG)-\d{3,})(?:-|$)")


def git(root: Path, *args: str, timeout: int = GIT_TIMEOUT) -> subprocess.CompletedProcess:
    """Run git in the store root without prompts; a timeout is reported as a failure."""
    command = ["git", "-C", str(root), *args]
    try:
        return subprocess.run(
            command, capture_output=True, text=True, encoding="utf-8", timeout=timeout,
            env={**os.environ, "GIT_TERMINAL_PROMPT": "0"},
        )
    except subprocess.TimeoutExpired:
        return subprocess.CompletedProcess(command, 1, "", f"git {args[0]} timed out after {timeout} s")
    except OSError as error:
        raise BacklogError(f"cannot run git: {error}") from error


def git_lines(root: Path, *args: str) -> list[str]:
    result = git(root, *args)
    return [line.strip() for line in result.stdout.splitlines() if line.strip()] if result.returncode == 0 else []


def merge_targets(root: Path, remotes: list[str]) -> list[str]:
    """Refs an item branch counts as merged into: local main and each remote's default branch."""
    def exists(ref: str) -> bool:
        return git(root, "rev-parse", "--verify", "--quiet", ref).returncode == 0

    targets = ["refs/heads/main"] if exists("refs/heads/main") else []
    for remote in remotes:
        head = git(root, "symbolic-ref", "--quiet", f"refs/remotes/{remote}/HEAD")
        if head.returncode == 0 and head.stdout.strip():
            targets.append(head.stdout.strip())
        elif exists(f"refs/remotes/{remote}/main"):
            targets.append(f"refs/remotes/{remote}/main")
    return targets


def item_branches(root: Path, remotes: list[str]) -> dict[str, list[str]]:
    """Unmerged item branches, local and remote-tracking, by item ID, most recent commit first.

    A local branch wins over the remote-tracking branch with the same name. On an item
    branch, every branch of its own ID is left out: the working tree is its freshest copy.
    """
    roots = ("refs/heads", "refs/remotes")
    merged: set[str] = set()
    for target in merge_targets(root, remotes):
        merged.update(git_lines(root, "for-each-ref", "--format=%(refname)", f"--merged={target}", *roots))
    by_name: dict[str, tuple[str, int, bool]] = {}
    for entry in git_lines(root, "for-each-ref", "--format=%(refname)%09%(committerdate:unix)", *roots):
        full, _, time = entry.partition("\t")
        if full in merged:
            continue
        if full.startswith("refs/heads/"):
            name, local = full[len("refs/heads/"):], True
            ref = name
        else:
            ref = full[len("refs/remotes/"):]
            remote = next((r for r in remotes if ref.startswith(f"{r}/")), None)
            if remote is None:
                continue
            name, local = ref[len(remote) + 1:], False
        if not ITEM_BRANCH.match(name):
            continue
        known = by_name.get(name)
        if known and (known[2] or not local):
            continue
        by_name[name] = (ref, int(time) if time.isdigit() else 0, local)
    current = git(root, "symbolic-ref", "--quiet", "--short", "HEAD").stdout.strip()
    current_match = ITEM_BRANCH.match(current)
    current_id = current_match[1] if current_match else None
    by_id: dict[str, list[tuple[str, int]]] = {}
    for name, (ref, time, _) in by_name.items():
        item_id = ITEM_BRANCH.match(name)[1]
        if item_id != current_id:
            by_id.setdefault(item_id, []).append((ref, time))
    return {item_id: [ref for ref, _ in sorted(refs, key=lambda c: -c[1])] for item_id, refs in by_id.items()}


def overlay_branches(store: Store, fetch: bool = True) -> str:
    """Replace each item with its copy on its unmerged item branch; return the fetch outcome.

    Rules in docs/PROCESS-PARALLEL.md §1. Items that exist only in a branch are not added.
    The source branch of each replaced item, and any other branch that carries it, are kept
    in store.branch_sources, the remotes in store.remotes. The outcome is "done", "failed",
    "skipped" (not asked or no remote) or "none" (not a git repository).
    """
    inside = git(store.root, "rev-parse", "--is-inside-work-tree")
    if inside.returncode != 0 or inside.stdout.strip() != "true":
        print("warning: not a git repository, branch data not available", file=sys.stderr)
        return "none"
    remotes = store.remotes = git_lines(store.root, "remote")
    outcome = "skipped"
    if fetch and remotes:
        target = ["origin"] if "origin" in remotes else []
        fetched = git(store.root, "fetch", "--prune", "--quiet", *target)
        outcome = "done" if fetched.returncode == 0 else "failed"
        if outcome == "failed":
            print(f"warning: git fetch failed, branch data may be stale: {fetched.stderr.strip()}", file=sys.stderr)
    for item_id, refs in item_branches(store.root, remotes).items():
        if item_id not in store.items:
            continue
        for ref in refs:
            shown = git(store.root, "show", f"{ref}:./backlog/items/{item_id}.json")
            if shown.returncode != 0:
                continue
            try:
                data = json.loads(shown.stdout)
            except json.JSONDecodeError:
                print(f"warning: {ref} holds an invalid item file for {item_id}", file=sys.stderr)
                continue
            if isinstance(data, dict) and data.get("id") == item_id:
                store.items[item_id] = data
                store.branch_sources[item_id] = {"source": ref, "also_in": [r for r in refs if r != ref]}
                break
    return outcome


# --- Plain list files -------------------------------------------------------


def read_bullets(path: Path) -> tuple[list[str], list[str]]:
    """Return the lines of a list file and the indices-free text of its bullets."""
    if not path.exists():
        return [], []
    lines = path.read_text(encoding="utf-8").splitlines()
    return lines, [line[2:].strip() for line in lines if line.startswith("- ")]


def change_bullets(path: Path, add: str | None, remove: int | None) -> None:
    lines, bullets = read_bullets(path)
    if add is not None:
        text = " ".join(add.split())
        if not text:
            raise BacklogError("the text is empty")
        lines.append(f"- {text}")
    if remove is not None:
        if not 1 <= remove <= len(bullets):
            raise BacklogError(f"no entry number {remove}: there are {len(bullets)}")
        seen = 0
        for index, line in enumerate(lines):
            if line.startswith("- "):
                seen += 1
                if seen == remove:
                    del lines[index]
                    break
    write_atomic(path, "".join(f"{line}\n" for line in lines))


def bullets_command(store: Store, args, name: str) -> int:
    path = store.base / name
    if args.add is not None or args.remove is not None:
        change_bullets(path, args.add, args.remove)
        return 0
    _, bullets = read_bullets(path)
    if args.json:
        print(json.dumps(bullets, ensure_ascii=False, indent=2))
    else:
        for number, bullet in enumerate(bullets, 1):
            print(f"{number}. {bullet}")
    return 0


# --- Reading commands -------------------------------------------------------


def progress(store: Store, version_id: str) -> dict:
    counts = {state: 0 for state in STATES}
    for item in store.items.values():
        if item.get("version") == version_id and item.get("status") in counts:
            counts[item["status"]] += 1
    total = sum(counts.values()) - counts["Dropped"]
    percent = round(counts["Done"] * 100 / total) if total else 0
    return {"version": version_id, "done": counts["Done"], "total": total, "percent": percent, "counts": counts}


def limited(records: list, limit: int = SECTION_LIMIT) -> tuple[list, int]:
    return records[:limit], max(len(records) - limit, 0)


def summary_line(item: dict) -> str:
    module = f" {item['module']}" if item.get("module") else ""
    return f"{item.get('priority')} {item['id']} {item.get('epic')}{module} — {shorten(item.get('title', ''))}"


def build_status(store: Store) -> dict:
    open_ids = {v["id"] for v in store.open_versions()}
    active = [i for i in store.items.values() if i.get("version") in open_ids]
    in_progress = sorted((i for i in active if i.get("status") == "In Progress"), key=ready_key)
    blocked = sorted((i for i in active if i.get("status") == "Blocked"), key=ready_key)
    closed = sorted(
        (v for v in store.versions.values() if v.get("state") == "Closed"),
        key=lambda v: version_key(v["id"]), reverse=True,
    )
    _, notes = read_bullets(store.base / "NOTES.md")
    return {
        "versions": [progress(store, v) for v in sorted(open_ids, key=version_key)],
        "in_progress": in_progress, "blocked": blocked, "ready": store.ready(),
        "completed": store.done(), "closed_versions": closed, "notes": notes,
    }


def print_section(title: str, records: list, render, limit: int = SECTION_LIMIT) -> None:
    shown, hidden = limited(records, limit)
    print(f"\n{title} ({len(records)})")
    for record in shown:
        print(f"  {render(record)}")
    if hidden:
        print(f"  … {hidden} more")


def cmd_status(store: Store, args) -> int:
    store.require_loaded()
    if args.branches:
        overlay_branches(store, fetch=not args.no_fetch)
    data = build_status(store)
    if args.json:
        slim = {
            key: limited(data[key])[0] for key in ("in_progress", "blocked", "ready", "completed", "closed_versions")
        }
        print(json.dumps({**data, **slim, "notes": data["notes"][:NOTES_LIMIT]}, ensure_ascii=False, indent=2))
        return 0
    print("Open versions")
    if not data["versions"]:
        print("  none")
    for entry in data["versions"]:
        counts = " · ".join(f"{state} {count}" for state, count in entry["counts"].items())
        print(f"  {entry['version']}: {entry['done']}/{entry['total']} done ({entry['percent']}%) · {counts}")
    print_section("In progress", data["in_progress"], lambda i: f"{summary_line(i)} [{i.get('branch')}]")
    print_section("Blocked", data["blocked"], lambda i: f"{summary_line(i)} — {shorten(i.get('blocked_by', ''))}")
    print_section("Ready", data["ready"], summary_line)
    print_section("Recently completed", data["completed"], lambda i: f"{i.get('closed_at')} {summary_line(i)}")
    print_section(
        "Closed versions", data["closed_versions"],
        lambda v: f"{v['id']} closed {v.get('closed_at')}, tag {v['id']}",
    )
    print_section("Notes", data["notes"], shorten, NOTES_LIMIT)
    if len(data["notes"]) > NOTES_LIMIT:
        print("  see the notes command for all of them")
    return 0


def print_items(items: list, total: int, as_json: bool) -> None:
    if as_json:
        print(json.dumps({"total": total, "items": items}, ensure_ascii=False, indent=2))
        return
    for item in items:
        print(f"{item.get('status')}: {summary_line(item)}")
    if len(items) < total:
        print(f"showing {len(items)} of {total}")


def cmd_list(store: Store, args) -> int:
    store.require_loaded()
    if args.branches:
        overlay_branches(store, fetch=not args.no_fetch)
    found = list(store.items.values())
    for field in ("version", "epic", "type", "priority", "status", "module"):
        wanted = getattr(args, field)
        if wanted is not None:
            found = [i for i in found if i.get(field) == wanted]
    if args.status is None and not args.include_closed:
        found = [i for i in found if i.get("status") not in ("Done", "Dropped")]
    found.sort(key=lambda i: item_key(i["id"]))
    print_items(found[: args.limit] if args.limit else found, len(found), args.json)
    return 0


def cmd_ready(store: Store, args) -> int:
    store.require_loaded()
    if args.branches:
        overlay_branches(store, fetch=not args.no_fetch)
    found = store.ready()
    print_items(found[: args.limit] if args.limit else found, len(found), args.json)
    return 0


ITEM_LABELS = (
    ("Epic", "epic"), ("Module", "module"), ("Type", "type"), ("Priority", "priority"),
    ("Status", "status"), ("Version", "version"), ("Branch", "branch"),
    ("Dependencies", "dependencies"), ("Dependency override", "dependency_override"),
    ("Requirements", "requirements"), ("Design references", "design_references"),
    ("Description", "description"), ("Found in", "found_in"),
    ("Steps to reproduce", "steps_to_reproduce"), ("Expected", "expected"), ("Actual", "actual"),
)


def item_lines(item: dict) -> list[str]:
    lines = []
    for label, field in ITEM_LABELS:
        value = item.get(field)
        if field == "dependencies" and not value:
            value = "none"
        if value not in (None, "", []):
            lines.append(f"- **{label}:** {', '.join(value) if isinstance(value, list) else value}")
    lines.append("- **Acceptance criteria:**")
    lines.extend(f"  - {criterion}" for criterion in item.get("acceptance_criteria", []))
    if item.get("remarks"):
        lines.append("- **Remarks:**")
        lines.extend(f"  - {remark}" for remark in item["remarks"])
    if item.get("blocked_by"):
        lines.append(f"- **Blocked by:** {item['blocked_by']}")
    if item.get("outcome"):
        lines.append(f"- **Outcome:** {item['outcome']} ({item.get('closed_at')})")
    return lines


def cmd_show(store: Store, args) -> int:
    store.require_loaded()
    if args.branches:
        overlay_branches(store, fetch=not args.no_fetch)
    item = store.item(args.id)
    if args.json:
        print(json.dumps(item, ensure_ascii=False, indent=2))
        return 0
    print(f"{item['id']} — {item.get('title')}")
    print("\n".join(item_lines(item)))
    origin = store.branch_sources.get(item["id"])
    if origin:
        print(f"- **From branch:** {origin['source']}")
        if origin["also_in"]:
            print(f"- **Also in:** {', '.join(origin['also_in'])}")
    return 0


def cmd_export(store: Store, args) -> int:
    store.require_loaded()
    fetch = overlay_branches(store, fetch=not args.no_fetch) if args.branches else None
    if args.json:
        data = {
            "versions": sorted(store.versions.values(), key=lambda v: version_key(v["id"])),
            "epics": sorted(store.epics.values(), key=lambda e: e["id"]),
            "items": sorted(store.items.values(), key=lambda i: item_key(i["id"])),
        }
        if fetch is not None:
            data["branches"] = {
                "fetch": fetch, "remotes": store.remotes, "items": dict(sorted(store.branch_sources.items())),
            }
        print(json.dumps(data, ensure_ascii=False, indent=2))
        return 0
    out = ["# Product Backlog"]
    for version in sorted(store.versions.values(), key=lambda v: version_key(v["id"])):
        vid = version["id"]
        state = version.get("state")
        if version.get("closed_at"):
            state = f"{state} ({version['closed_at']})"
        out += ["", f"## Version {vid}", "", f"**State:** {state}", "", f"**Goal:** {version.get('goal')}"]
        out += [f"\n**Scope change:** {change}" for change in version.get("scope_changes", [])]
        items = [i for i in store.items.values() if i.get("version") == vid]
        for eid in sorted({i.get("epic") for i in items}, key=str):
            epic = store.epics.get(eid, {})
            out += ["", f"### {eid} — {epic.get('title')}", "", f"**Scope:** {epic.get('scope')}"]
            for item in sorted((i for i in items if i.get("epic") == eid), key=lambda i: item_key(i["id"])):
                out += ["", f"#### {item['id']} — {item.get('title')}", "", *item_lines(item)]
    _, ideas = read_bullets(store.base / "IDEAS.md")
    out += ["", "## Unassigned backlog", ""]
    unassigned = sorted((i for i in store.items.values() if not i.get("version")), key=lambda i: item_key(i["id"]))
    out += [f"- {idea}" for idea in ideas] or ([] if unassigned else ["None."])
    for item in unassigned:
        out += ["", f"#### {item['id']} — {item.get('title')}", "", *item_lines(item)]
    print("\n".join(out))
    return 0


def cmd_check(store: Store, args) -> int:
    errors = validate(store)
    if args.json:
        print(json.dumps(
            {"ok": not errors, "errors": [{"where": w, "message": m} for w, m in errors]},
            ensure_ascii=False, indent=2,
        ))
    elif errors:
        for where, message in errors:
            print(f"{where}: {message}")
        print(f"check failed: {len(errors)} error(s)")
    else:
        print(f"check OK: {len(store.items)} items, {len(store.epics)} epics, {len(store.versions)} versions")
    return 1 if errors else 0


# --- Writing commands -------------------------------------------------------


def split_list(value: str | None) -> list[str] | None:
    return None if value is None else [part.strip() for part in value.split(",") if part.strip()]


ITEM_ARGUMENTS = {
    "title": "title", "version": "version", "epic": "epic", "module": "module",
    "priority": "priority", "description": "description", "found_in": "found_in",
    "steps_to_reproduce": "steps_to_reproduce", "expected": "expected", "actual": "actual",
}
ITEM_LIST_ARGUMENTS = ("dependencies", "requirements", "design_references")


def apply_item_arguments(item: dict, args) -> None:
    for argument, field in ITEM_ARGUMENTS.items():
        value = getattr(args, argument)
        if value is not None:
            item[field] = value
    for field in ITEM_LIST_ARGUMENTS:
        value = split_list(getattr(args, field))
        if value is not None:
            item[field] = value
    if args.criterion is not None:
        item["acceptance_criteria"] = args.criterion
    if args.remark is not None:
        item["remarks"] = args.remark


def cmd_add(store: Store, args) -> int:
    store.require_loaded()
    if bool(args.version) == args.unassigned:
        raise BacklogError("pass exactly one of --version and --unassigned")
    prefix = args.type
    item = {
        "id": store.next_id(prefix), "type": TYPES[prefix][0], "status": "Todo",
        "dependencies": [], "acceptance_criteria": [],
    }
    apply_item_arguments(item, args)
    save(store, "items", item)
    print(item["id"])
    return 0


def cmd_edit(store: Store, args) -> int:
    store.require_loaded()
    item = dict(store.item(args.id))
    apply_item_arguments(item, args)
    save(store, "items", item)
    print(item["id"])
    return 0


def require_status(item: dict, allowed: tuple, action: str) -> None:
    if item.get("status") not in allowed:
        raise BacklogError(f"cannot {action} {item['id']}: it is {item.get('status')}")


def current_branch(root: Path) -> str:
    result = git(root, "branch", "--show-current")
    branch = result.stdout.strip()
    if result.returncode != 0 or not branch:
        raise BacklogError("cannot read the current branch: pass --branch")
    return branch


def cmd_start(store: Store, args) -> int:
    store.require_loaded()
    item = dict(store.item(args.id))
    require_status(item, ("Todo",), "start")
    if not item.get("version"):
        raise BacklogError(f"{item['id']} has no version: assign one with edit before starting it")
    missing = [
        d for d in item.get("dependencies", [])
        if store.items.get(d, {}).get("status") != "Done"
    ]
    if missing and not args.override_dependencies:
        raise BacklogError(
            f"{item['id']} has dependencies not Done: {', '.join(missing)}. "
            "Only if the user asked for it, pass --override-dependencies REASON"
        )
    if missing:
        item["dependency_override"] = args.override_dependencies
    item["branch"] = args.branch or current_branch(store.root)
    item["status"] = "In Progress"
    save(store, "items", item)
    print(f"{item['id']} In Progress on {item['branch']}")
    return 0


def cmd_block(store: Store, args) -> int:
    store.require_loaded()
    item = dict(store.item(args.id))
    require_status(item, ("Todo", "In Progress"), "block")
    item["status"] = "Blocked"
    item["blocked_by"] = args.reason
    save(store, "items", item)
    print(f"{item['id']} Blocked")
    return 0


def cmd_resume(store: Store, args) -> int:
    store.require_loaded()
    item = dict(store.item(args.id))
    require_status(item, ("Blocked",), "resume")
    item["status"] = "In Progress" if item.get("branch") else "Todo"
    item.pop("blocked_by", None)
    save(store, "items", item)
    print(f"{item['id']} {item['status']}")
    return 0


def cmd_done(store: Store, args) -> int:
    store.require_loaded()
    item = dict(store.item(args.id))
    require_status(item, ("In Progress",), "complete")
    item.update(status="Done", outcome=args.outcome, closed_at=today())
    save(store, "items", item)
    print(f"{item['id']} Done")
    return 0


def cmd_reopen(store: Store, args) -> int:
    store.require_loaded()
    item = dict(store.item(args.id))
    require_status(item, ("Done",), "reopen")
    item["status"] = "In Progress" if item.get("branch") else "Todo"
    item.pop("outcome", None)
    item.pop("closed_at", None)
    save(store, "items", item)
    print(f"{item['id']} {item['status']}")
    return 0


def cmd_drop(store: Store, args) -> int:
    store.require_loaded()
    item = dict(store.item(args.id))
    require_status(item, ("Todo", "In Progress", "Blocked"), "drop")
    dependents = sorted(
        i["id"] for i in store.items.values()
        if args.id in i.get("dependencies", []) and i.get("status") not in ("Done", "Dropped")
    )
    if dependents:
        raise BacklogError(f"cannot drop {args.id}: still needed by {', '.join(dependents)}")
    item.update(status="Dropped", outcome=args.reason, closed_at=today())
    item.pop("blocked_by", None)
    save(store, "items", item)
    print(f"{item['id']} Dropped")
    return 0


def cmd_version_add(store: Store, args) -> int:
    store.require_loaded()
    if args.id in store.versions:
        raise BacklogError(f"version {args.id} already exists")
    state = "Planned" if args.planned else "Open"
    save(store, "versions", {"id": args.id, "goal": args.goal, "state": state})
    print(args.id)
    return 0


def cmd_version_open(store: Store, args) -> int:
    store.require_loaded()
    version = store.versions.get(args.id)
    if version is None:
        raise BacklogError(f"version {args.id} not found")
    if version.get("state") != "Planned":
        raise BacklogError(f"version {args.id} is not Planned")
    save(store, "versions", {**version, "state": "Open"})
    print(f"{args.id} Open")
    return 0


def cmd_version_edit(store: Store, args) -> int:
    store.require_loaded()
    if args.id not in store.versions:
        raise BacklogError(f"version {args.id} not found")
    version = dict(store.versions[args.id])
    if args.goal is not None:
        version["goal"] = args.goal
    if args.scope_change is not None:
        version["scope_changes"] = [*version.get("scope_changes", []), f"{today()}: {' '.join(args.scope_change.split())}"]
    save(store, "versions", version)
    print(args.id)
    return 0


def cmd_epic_add(store: Store, args) -> int:
    store.require_loaded()
    epic = {"id": store.next_epic_id(), "title": args.title, "scope": args.scope}
    save(store, "epics", epic)
    print(epic["id"])
    return 0


def cmd_epic_edit(store: Store, args) -> int:
    store.require_loaded()
    if args.id not in store.epics:
        raise BacklogError(f"epic {args.id} not found")
    epic = dict(store.epics[args.id])
    if args.title is not None:
        epic["title"] = args.title
    if args.scope is not None:
        epic["scope"] = args.scope
    save(store, "epics", epic)
    print(args.id)
    return 0


def cmd_close_version(store: Store, args) -> int:
    store.require_loaded()
    version = store.versions.get(args.id)
    if version is None:
        raise BacklogError(f"version {args.id} not found")
    if version.get("state") != "Open":
        raise BacklogError(f"version {args.id} is not Open")
    pending = sorted(
        (i["id"] for i in store.items.values()
         if i.get("version") == args.id and i.get("status") not in ("Done", "Dropped")),
        key=item_key,
    )
    if pending:
        raise BacklogError(f"version {args.id} has unfinished items: {', '.join(pending)}")
    save(store, "versions", {**version, "state": "Closed", "closed_at": today()})
    print(f"{args.id} Closed")
    return 0


# --- Migration from BACKLOG.md ----------------------------------------------

IMPORT_TEXT = {
    "description": "description", "found in": "found_in", "steps to reproduce": "steps_to_reproduce",
    "expected": "expected", "actual": "actual", "blocked by": "blocked_by", "outcome": "outcome",
    "dependency override": "dependency_override",
}
IMPORT_LISTS = {"dependencies": "dependencies", "requirements": "requirements", "design references": "design_references"}
IMPORT_PLAIN = {"type": "type", "priority": "priority", "status": "status", "branch": "branch", "epic": "epic", "module": "module"}
IMPORT_SKIPPED_SECTIONS = ("management", "dependencies and suggested order")
EMPTY_VALUES = ("none", "-", "—", "n/a")
FIELD_LINE = re.compile(r"^- \*\*[^*:]+:\*\*")
FIELD_PART = re.compile(r"\s*·\s*(?=\*\*[^*:]+:\*\*)")
HEADING_ID = re.compile(r"^(\S+) — (.+)$")
OLD_STATUS = re.compile(r"^(Todo|In Progress|Blocked|Done|Dropped)(?:\s*\(.*\))?$")
IDEAS_INTRO = "Ideas not assigned to any version. They need requirements before they can be designed."
DATE_IN_TEXT = re.compile(r"\b\d{4}-\d{2}-\d{2}\b")


class BacklogImport:
    """Parses a hand-written BACKLOG.md by its structural labels; never guesses."""

    def __init__(self, store: Store, source: str):
        self.store = store
        self.source = source
        self.problems: list[tuple[int, str]] = []
        self.skipped: list[str] = []
        self.ideas: list[str] = []
        self.source_counts: dict[str, dict[str, int]] = {}
        self.item_lines: dict[str, int] = {}
        self.remarks: list[str] = []
        self.version = self.epic = self.item = None
        self.field: str | None = None
        self.section = "top"

    def problem(self, number: int, message: str) -> None:
        self.problems.append((number, message))

    def parse(self, text: str) -> None:
        for number, raw in enumerate(text.splitlines(), 1):
            line = raw.rstrip()
            if line.strip():
                self.parse_line(number, line)
        self.finish()

    def parse_line(self, number: int, line: str) -> None:
        if line.startswith("#"):
            self.parse_heading(number, line)
        elif self.section == "skip":
            pass
        elif self.item is not None:
            self.parse_item_line(number, line)
        elif self.section == "ideas":
            self.parse_idea(number, line)
        elif SCOPE_CHANGE_LINE.match(line) and self.version is not None:
            found = SCOPE_CHANGE_LINE.match(line)
            self.version.setdefault("scope_changes", []).append(f"{found[1]}: {found[2].strip()}")
        elif self.epic is not None:
            self.parse_labeled(number, line, self.epic, "scope", "**Scope:**")
        elif self.version is not None:
            self.parse_version_line(number, line)
        else:
            self.problem(number, f"unrecognized line: {shorten(line)}")

    def parse_heading(self, number: int, line: str) -> None:
        level = len(line) - len(line.lstrip("#"))
        title = line[level:].strip()
        self.item = self.field = None
        if level == 1:
            return
        if level == 2:
            self.parse_section(number, title)
        elif level == 3 and self.section == "version":
            self.parse_epic(number, title)
        elif level == 4 and (self.section == "ideas" or (self.section == "version" and self.epic is not None)):
            self.parse_item_heading(number, title)
        elif self.section != "skip":
            self.problem(number, f"unexpected heading: {shorten(line)}")

    def parse_section(self, number: int, title: str) -> None:
        self.version = self.epic = None
        match = re.match(r"^Version (v\S+)$", title)
        lowered = title.lower()
        if match:
            self.section = "version"
            self.version = {"id": match[1]}
            if match[1] in self.store.versions:
                self.problem(number, f"version {match[1]} appears twice")
            self.store.versions[match[1]] = self.version
            self.source_counts[match[1]] = {}
        elif lowered == "unassigned backlog":
            self.section = "ideas"
            self.source_counts[None] = {}
        elif lowered in IMPORT_SKIPPED_SECTIONS:
            self.section = "skip"
            self.skipped.append(title)
        else:
            self.section = "skip"
            self.problem(number, f"unknown section: {shorten(title)}")

    def parse_epic(self, number: int, title: str) -> None:
        match = HEADING_ID.match(title)
        if not match or not EPIC_ID.match(match[1]):
            self.epic = None
            self.section = "skip"
            self.problem(number, f"cannot read the epic heading: {shorten(title)}")
            return
        known = self.store.epics.get(match[1])
        if known and known["title"] != match[2]:
            self.problem(number, f"{match[1]} has two different titles")
        self.epic = known or {"id": match[1], "title": match[2]}
        self.epic_seen_scope = False
        self.store.epics[match[1]] = self.epic

    def parse_item_heading(self, number: int, title: str) -> None:
        match = HEADING_ID.match(title)
        if not match or not ITEM_ID.match(match[1]):
            self.problem(number, f"cannot read the item heading: {shorten(title)}")
            return
        if match[1] in self.store.items:
            self.problem(number, f"item {match[1]} appears twice")
        self.item = {
            "id": match[1], "title": match[2], "dependencies": [], "acceptance_criteria": [],
        }
        if self.section == "version":
            self.item.update(version=self.version["id"], epic=self.epic["id"])
        self.store.items[match[1]] = self.item
        self.item_lines[match[1]] = number

    def parse_labeled(self, number: int, line: str, record: dict, field: str, label: str) -> None:
        if not line.startswith(label):
            self.problem(number, f"unrecognized line: {shorten(line)}")
            return
        value = line[len(label):].strip()
        if record.get(field) not in (None, value):
            self.problem(number, f"{record['id']} has two different values for {field}")
        record[field] = value

    def parse_version_line(self, number: int, line: str) -> None:
        if line.startswith("**State:**"):
            value = line[len("**State:**"):].strip()
            match = re.match(r"^(Open|Closed|Planned)\b(.*)$", value)
            if not match:
                self.problem(number, f"unknown version state: {shorten(value)}")
                return
            self.version["state"] = match[1]
            date = DATE_IN_TEXT.search(match[2])
            if date:
                self.version["closed_at"] = date[0]
        else:
            self.parse_labeled(number, line, self.version, "goal", "**Goal:**")

    def parse_idea(self, number: int, line: str) -> None:
        if line == IDEAS_INTRO:
            return
        if not line.startswith("- "):
            self.problem(number, f"unrecognized line: {shorten(line)}")
        elif line[2:].strip() != "`<idea>`":
            self.ideas.append(line[2:].strip())

    def parse_item_line(self, number: int, line: str) -> None:
        if FIELD_LINE.match(line):
            for part in FIELD_PART.split(line[2:]):
                self.parse_field(number, part)
        elif line.startswith("  "):
            self.parse_continuation(number, line)
        else:
            self.field = None
            self.problem(number, f"unrecognized line in {self.item['id']}: {shorten(line)}")

    def parse_field(self, number: int, part: str) -> None:
        match = re.match(r"^\*\*([^*:]+):\*\*\s*(.*)$", part)
        label, value = match[1].strip().lower(), match[2].strip()
        self.field = None
        if label == "acceptance criteria":
            self.field = "acceptance_criteria"
        elif label in IMPORT_TEXT:
            self.field = IMPORT_TEXT[label]
            self.item[self.field] = value
        elif label == "requirements" and self.section == "ideas":
            self.parse_unassigned_requirements(value)
        elif label in IMPORT_LISTS:
            self.item[IMPORT_LISTS[label]] = self.parse_list(value)
        elif label == "version":
            self.parse_version_field(number, value)
        elif label in IMPORT_PLAIN:
            self.parse_plain(number, IMPORT_PLAIN[label], value)
        else:
            self.add_remark(match[1].strip(), value)

    def add_remark(self, label: str, value: str) -> None:
        """Keep a field the format does not have, with its label, so that nothing is lost."""
        self.item.setdefault("remarks", []).append(f"{label}: {value}")
        self.field = "remarks"
        self.remarks.append(f"{self.item['id']}: {label}")

    def parse_unassigned_requirements(self, value: str) -> None:
        """An unassigned item may have open requirements: keep the IDs and the original text."""
        tokens = self.parse_list(value)
        if all(REQUIREMENT_ID.match(token) for token in tokens):
            self.item["requirements"] = tokens
            return
        self.item["requirements"] = REQUIREMENT_IN_TEXT.findall(value)
        self.add_remark("Requirements", value)
        self.field = None

    def parse_version_field(self, number: int, value: str) -> None:
        value = value.strip("`")
        if self.section == "ideas":
            if VERSION_ID.match(value):
                self.problem(number, f"{self.item['id']} is unassigned but its Version field says {value}")
        elif value != self.item["version"]:
            self.problem(number, f"{self.item['id']} is under {self.item['version']} but its Version field says {value}")

    @staticmethod
    def parse_list(value: str) -> list[str]:
        if value.lower() in EMPTY_VALUES:
            return []
        return [part.strip().strip("`") for part in value.split(",") if part.strip()]

    def parse_plain(self, number: int, field: str, value: str) -> None:
        value = value.strip("`")
        if value.lower() in EMPTY_VALUES:
            return
        if field == "status":
            match = OLD_STATUS.match(value)
            if not match:
                self.problem(number, f"unknown status {shorten(value)!r} in {self.item['id']}")
                return
            value = match[1]
        elif field in ("epic", "module"):
            value = value.split()[0]
        if field == "epic" and self.section == "version" and value != self.item["epic"]:
            self.problem(number, f"{self.item['id']} is under {self.item['epic']} but its Epic field says {value}")
            return
        self.item[field] = value

    def parse_continuation(self, number: int, line: str) -> None:
        text = line.strip()
        if self.field == "acceptance_criteria":
            criteria = self.item["acceptance_criteria"]
            if line.startswith("  - "):
                criteria.append(text[2:].strip())
            elif criteria:
                criteria[-1] += f" {text[2:].strip() if text.startswith('- ') else text}"
            else:
                self.problem(number, f"unrecognized line in {self.item['id']}: {shorten(line)}")
        elif self.field == "remarks":
            self.item["remarks"][-1] += f"\n{text}"
        elif self.field in IMPORT_TEXT.values():
            self.item[self.field] = f"{self.item[self.field]}\n{text}".strip()
        else:
            self.problem(number, f"unrecognized line in {self.item['id']}: {shorten(line)}")

    def finish(self) -> None:
        for iid, item in self.store.items.items():
            if item.get("status") in ("Done", "Dropped"):
                dates = DATE_IN_TEXT.findall(item.get("outcome", ""))
                if dates:
                    item["closed_at"] = dates[-1]
                else:
                    self.problem(self.item_lines[iid], f"{iid} is {item['status']} but its Outcome has no date YYYY-MM-DD")

    def count_source(self, text: str) -> None:
        """Count states with a plain text scan, independent of the parser."""
        counts = None
        for line in text.splitlines():
            if line.startswith("## "):
                match = re.match(r"^## Version (v\S+)$", line.rstrip())
                unassigned = line.strip().lower() == "## unassigned backlog"
                counts = self.source_counts.get(match[1]) if match else self.source_counts.get(None) if unassigned else None
            found = re.search(r"\*\*Status:\*\*\s*([A-Za-z ]*[A-Za-z])", line)
            if found and counts is not None:
                counts[found[1]] = counts.get(found[1], 0) + 1


def read_status_notes(path: Path) -> tuple[list[str], list[str]]:
    """Return the bullets of the Notes section of STATUS.md and its unrecognized lines."""
    if not path.exists():
        return [], []
    notes, unknown, inside = [], [], False
    for line in path.read_text(encoding="utf-8").splitlines():
        if line.startswith("## "):
            inside = line.strip().lower() == "## notes"
        elif inside and line.startswith("- "):
            notes.append(line[2:].strip())
        elif inside and line.strip() and line.strip().rstrip(".").lower() != "none":
            unknown.append(line.strip())
    return notes, unknown


def state_counts(store: Store, version_id: str) -> dict[str, int]:
    counts = progress(store, version_id)["counts"]
    return {state: count for state, count in counts.items() if count}


def compare_counts(importer: BacklogImport) -> list[str]:
    differences = []
    for version_id, expected in importer.source_counts.items():
        actual = state_counts(importer.store, version_id)
        if expected != actual:
            differences.append(f"{version_id or 'unassigned'}: source {expected}, imported {actual}")
    return differences


def text_file(title: str, bullets: list[str]) -> str:
    body = "".join(f"- {' '.join(bullet.split())}\n" for bullet in bullets)
    return f"# {title}\n" + (f"\n{body}" if body else "")


def cmd_import_md(store: Store, args) -> int:
    store.require_loaded()
    if store.items or store.versions or store.epics:
        raise BacklogError("backlog/ already contains records: import only into an empty store")
    source = args.source or store.root / "BACKLOG.md"
    status = args.status or store.root / "STATUS.md"
    if not source.exists():
        raise BacklogError(f"{source} not found")
    text = source.read_text(encoding="utf-8")
    importer = BacklogImport(store, str(source))
    importer.parse(text)
    importer.count_source(text)
    notes, unknown_notes = read_status_notes(status)

    unrecognized = [f"{source.name}:{number}: {message}" for number, message in sorted(importer.problems)]
    unrecognized += [f"{status.name}: unrecognized line in Notes: {shorten(line)}" for line in unknown_notes]
    blocking = [] if args.skip_unrecognized else list(unrecognized)
    blocking += [f"{where}: {message}" for where, message in validate(store)]
    blocking += [f"state counts differ, {difference}" for difference in compare_counts(importer)]
    if importer.problems and args.skip_unrecognized:
        for message in unrecognized:
            print(f"skipped: {message}")
    for section in importer.skipped:
        print(f"ignored section: {section}")
    if blocking:
        for message in blocking:
            print(message)
        print(f"import refused: {len(blocking)} problem(s), nothing was written")
        return 1

    for version_id in sorted(store.versions, key=version_key):
        print(f"{version_id}: {state_counts(store, version_id)}")
    if state_counts(store, None):
        print(f"unassigned: {state_counts(store, None)}")
    for remark in importer.remarks:
        print(f"kept as remark: {remark}")
    print(f"{len(store.items)} items, {len(store.epics)} epics, {len(importer.ideas)} ideas, {len(notes)} notes")
    if args.dry_run:
        print("dry run: nothing was written")
        return 0

    for kind in Store.KINDS:
        for record in getattr(store, kind).values():
            store.write(kind, record)
    write_atomic(store.base / "NOTES.md", text_file("Notes", notes))
    write_atomic(store.base / "IDEAS.md", text_file("Unassigned ideas", importer.ideas))
    written = Store(store.root)
    errors = validate(written)
    for where, message in errors:
        print(f"{where}: {message}")
    if errors:
        print("import written but check failed: review backlog/")
        return 1
    print(f"check OK. Review backlog/, then delete {source.name} and {status.name}.")
    return 0


# --- Command line -----------------------------------------------------------


def add_item_options(parser: argparse.ArgumentParser, creating: bool) -> None:
    parser.add_argument("--title", required=creating)
    parser.add_argument("--version", help="an empty value on edit makes the item unassigned")
    parser.add_argument("--epic", required=creating)
    parser.add_argument("--priority", required=creating, choices=None if not creating else PRIORITIES)
    parser.add_argument("--module")
    parser.add_argument("--dependencies", help="comma-separated item IDs")
    parser.add_argument("--requirements", help="comma-separated requirement IDs")
    parser.add_argument("--design-references", dest="design_references", help="comma-separated references")
    parser.add_argument("--description")
    parser.add_argument("--found-in", dest="found_in")
    parser.add_argument("--steps-to-reproduce", dest="steps_to_reproduce")
    parser.add_argument("--expected")
    parser.add_argument("--actual")
    parser.add_argument(
        "--criterion", action="append", required=creating,
        help="acceptance criterion, repeatable; with edit the given list replaces the existing one",
    )
    parser.add_argument("--remark", action="append", help="free remark, repeatable; with edit the given list replaces the existing one")


def reading(subparsers, name: str, handler, help_text: str, branches: bool = True):
    parser = subparsers.add_parser(name, help=help_text)
    parser.add_argument("--json", action="store_true")
    if branches:
        parser.add_argument(
            "--branches", action="store_true",
            help="fetch, then show each item as it is on its unmerged local or remote item branch",
        )
        parser.add_argument("--no-fetch", action="store_true", help="with --branches, use the refs already fetched")
    parser.set_defaults(handler=handler)
    return parser


def writing(subparsers, name: str, handler, help_text: str):
    parser = subparsers.add_parser(name, help=help_text)
    parser.set_defaults(handler=handler)
    return parser


def list_file_parser(subparsers, name: str, file_name: str, help_text: str):
    parser = subparsers.add_parser(name, help=help_text)
    parser.add_argument("--json", action="store_true")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--add", metavar="TEXT")
    group.add_argument("--remove", metavar="N", type=int)
    parser.set_defaults(handler=lambda store, args: bullets_command(store, args, file_name))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="backlog.py", description="Read and change the backlog store.")
    parser.add_argument("--root", type=Path, help=argparse.SUPPRESS)
    commands = parser.add_subparsers(dest="command", required=True)

    reading(commands, "status", cmd_status, "short project status")
    listing = reading(commands, "list", cmd_list, "list items; Done and Dropped only on request")
    listing.add_argument("--version")
    listing.add_argument("--epic")
    listing.add_argument("--type", choices=[name for name, _ in TYPES.values()])
    listing.add_argument("--priority", choices=PRIORITIES)
    listing.add_argument("--status", choices=STATES)
    listing.add_argument("--module")
    listing.add_argument("--include-closed", action="store_true", help="also list Done and Dropped items")
    listing.add_argument("--limit", type=int, default=DEFAULT_LIST_LIMIT, help="0 means no limit")
    ready = reading(commands, "ready", cmd_ready, "Todo items of open versions with all dependencies Done")
    ready.add_argument("--limit", type=int, default=SECTION_LIMIT, help="0 means no limit")
    show = reading(commands, "show", cmd_show, "one item in full")
    show.add_argument("id")
    reading(commands, "export", cmd_export, "whole backlog on stdout, never committed")
    reading(commands, "check", cmd_check, "validate the store", branches=False)
    list_file_parser(commands, "notes", "NOTES.md", "read or change the cross-cutting notes")
    list_file_parser(commands, "ideas", "IDEAS.md", "read or change the unassigned ideas")

    add = writing(commands, "add", cmd_add, "create an item and assign its ID")
    add.add_argument("--type", required=True, choices=list(TYPES))
    add.add_argument("--unassigned", action="store_true", help="no version yet: the item cannot start until it has one")
    add_item_options(add, creating=True)
    edit = writing(commands, "edit", cmd_edit, "change the fields of an item; an empty value clears an optional field")
    edit.add_argument("id")
    add_item_options(edit, creating=False)

    start = writing(commands, "start", cmd_start, "Todo to In Progress")
    start.add_argument("id")
    start.add_argument("--branch", help="default: the current git branch")
    start.add_argument("--override-dependencies", metavar="REASON", help="only on explicit user request")
    block = writing(commands, "block", cmd_block, "set Blocked")
    block.add_argument("id")
    block.add_argument("--reason", required=True)
    resume = writing(commands, "resume", cmd_resume, "leave Blocked")
    resume.add_argument("id")
    done = writing(commands, "done", cmd_done, "In Progress to Done")
    done.add_argument("id")
    done.add_argument("--outcome", required=True)
    reopen = writing(commands, "reopen", cmd_reopen, "leave Done")
    reopen.add_argument("id")
    drop = writing(commands, "drop", cmd_drop, "set Dropped; the file is kept so the ID is never reused")
    drop.add_argument("id")
    drop.add_argument("--reason", required=True)

    version = commands.add_parser("version", help="version records").add_subparsers(dest="action", required=True)
    version_add = writing(version, "add", cmd_version_add, "create a version, Open unless --planned")
    version_add.add_argument("id")
    version_add.add_argument("--goal", required=True)
    version_add.add_argument("--planned", action="store_true", help="a future version, not open yet")
    version_open = writing(version, "open", cmd_version_open, "Planned to Open")
    version_open.add_argument("id")
    version_edit = writing(version, "edit", cmd_version_edit, "change the goal or record a scope change")
    version_edit.add_argument("id")
    version_edit.add_argument("--goal")
    version_edit.add_argument("--scope-change", dest="scope_change", metavar="TEXT", help="appended with today's date")

    epic = commands.add_parser("epic", help="epic records").add_subparsers(dest="action", required=True)
    epic_add = writing(epic, "add", cmd_epic_add, "create an epic and assign its ID")
    epic_add.add_argument("--title", required=True)
    epic_add.add_argument("--scope", required=True)
    epic_edit = writing(epic, "edit", cmd_epic_edit, "change title or scope")
    epic_edit.add_argument("id")
    epic_edit.add_argument("--title")
    epic_edit.add_argument("--scope")

    importer = writing(commands, "import-md", cmd_import_md, "migrate a BACKLOG.md into an empty store")
    importer.add_argument("--from", dest="source", type=Path, help="default: BACKLOG.md of the project")
    importer.add_argument("--status", type=Path, help="source of the notes; default: STATUS.md of the project")
    importer.add_argument("--dry-run", action="store_true", help="validate and report, write nothing")
    importer.add_argument(
        "--skip-unrecognized", action="store_true", help="import anyway, listing the lines that are left out",
    )

    close = writing(commands, "close-version", cmd_close_version, "close a version whose items are finished")
    close.add_argument("id")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    root = (args.root or Path(__file__).resolve().parents[2]).resolve()
    try:
        return args.handler(Store(root), args)
    except BacklogError as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    except BrokenPipeError:
        sys.stderr.close()
        return 0


if __name__ == "__main__":
    sys.exit(main())
