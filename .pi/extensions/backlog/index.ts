/**
 * Backlog overlay — read-only browser for the items of backlog/.
 *
 * Open with ctrl+shift+b or /backlog. The shortcut can be changed in pi's
 * settings.json (global or project): `"backlogOverlay": { "shortcut": "alt+b" }`,
 * or disabled with `false`. One item per screen:
 *   ←/→ or ↑/↓  previous / next item (by version, epic and ID)
 *   Home/End    first / last item
 *   t/T         next / previous Type filter     (all, User Story, Task, Spike, Bug)
 *   p/P         next / previous Priority filter (all, P0, P1, P2)
 *   s/S         next / previous Status filter   (all, Todo, In Progress, Blocked, Done, Dropped)
 *   PgUp/PgDn   scroll the current item
 *   Esc or q    close
 *
 * Navigation visits only the items that match all three filters. The filters
 * start as `Type: all · Priority: all · Status: Todo`, are kept in memory for
 * the rest of the pi session and reset when pi restarts or on /reload.
 *
 * Item branches: states are resolved by the backlog CLI
 * (`export --json --branches`, rules in docs/PROCESS-PARALLEL.md §1): each item
 * is shown as it is on its unmerged item branch, local or remote-tracking, and the
 * header shows `from <ref>` and `also in: …`. The overlay opens at once with the
 * current directory, then asks the CLI for the states from the local refs and,
 * when the repository has a remote, for the states after `git fetch --prune`,
 * updating as each answer arrives. Only git refs are updated; files of the
 * working tree are never written.
 *
 * Project-agnostic: it relies only on the JSON output of the backlog CLI.
 * It never writes any file.
 */

import { execFile, execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
	CONFIG_DIR_NAME,
	type ExtensionAPI,
	type ExtensionContext,
	getAgentDir,
	type Theme,
} from "@earendil-works/pi-coding-agent";
import { matchesKey, truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";

const BACKLOG_TOOL = join(".agents", "tools", "backlog.py");
const DEFAULT_SHORTCUT = "ctrl+shift+b";
/** Reading the store; branch resolution with a fetch also waits for git (10 s fetch timeout in the CLI). */
const READ_TIMEOUT_MS = 5_000;
const BRANCHES_TIMEOUT_MS = 30_000;

interface BacklogItem {
	/** Heading text after `#### `, e.g. `US-001 — Title`. */
	heading: string;
	/** Version heading text, e.g. `Version v0.1.0`, if the item is inside a version section. */
	version?: string;
	/** Value of `**State:**` of the version, e.g. `Open`. */
	versionState?: string;
	/** Epic heading text, e.g. `EPIC-001 — Title`. */
	epic?: string;
	/** Raw Markdown lines of the item body, in file order. */
	body: string[];
	/** Ref the item was read from, e.g. `origin/task/TEC-007-slug`; undefined for the current directory. */
	source?: string;
	/** Other unmerged branches that also carry the item. */
	alsoIn?: string[];
}

type FetchState = "none" | "fetching" | "failed" | "done";

/** Fields of the JSON records of the backlog store. */
type BacklogRecord = Record<string, unknown>;

/** Versions and epics of the store, needed to describe items read from branches. */
interface Lookup {
	versions: Map<string, BacklogRecord>;
	epics: Map<string, BacklogRecord>;
}

type LoadResult = { items: BacklogItem[]; lookup: Lookup } | { message: string };

/** Output of `backlog export --json [--branches]`. */
interface ExportedStore {
	versions: BacklogRecord[];
	epics: BacklogRecord[];
	items: BacklogRecord[];
	branches?: {
		fetch: "done" | "failed" | "skipped" | "none";
		remotes: string[];
		items: Record<string, { source: string; also_in: string[] }>;
	};
}

// ---------------------------------------------------------------------------
// Filters (values and order from docs/PROCESS.md §4.3, §4.5, §4.6)
// ---------------------------------------------------------------------------

const ALL = "all";

const FILTERS = [
	{ key: "t", field: "Type", values: [ALL, "User Story", "Task", "Spike", "Bug"] },
	{ key: "p", field: "Priority", values: [ALL, "P0", "P1", "P2"] },
	{ key: "s", field: "Status", values: [ALL, "Todo", "In Progress", "Blocked", "Done", "Dropped"] },
] as const;

type FilterField = (typeof FILTERS)[number]["field"];
type Filters = Record<FilterField, string>;

function defaultFilters(): Filters {
	return { Type: ALL, Priority: ALL, Status: "Todo" };
}

/** Value of the first top-level `**Field:** value` of the item, e.g. `Done (see Outcome)`. */
function fieldValue(item: BacklogItem, field: string): string | undefined {
	const wanted = field.toLowerCase();
	for (const line of item.body) {
		const bullet = /^[-*+]\s+(.*)$/.exec(line);
		if (!bullet) continue;
		const text = bullet[1]!;
		const matches = [...text.matchAll(/\*\*([^*:]+):\*\*\s*/g)];
		for (let i = 0; i < matches.length; i++) {
			const m = matches[i]!;
			if (m[1]!.trim().toLowerCase() !== wanted) continue;
			const start = m.index! + m[0].length;
			const end = i + 1 < matches.length ? matches[i + 1]!.index! : text.length;
			return text.slice(start, end).replace(/\s*·\s*$/, "").trim();
		}
	}
	return undefined;
}

function matchesFilters(item: BacklogItem, filters: Filters): boolean {
	return FILTERS.every(({ field }) => {
		const selected = filters[field];
		if (selected === ALL) return true;
		const value = fieldValue(item, field);
		return value !== undefined && value.toLowerCase().startsWith(selected.toLowerCase());
	});
}

function describeFilters(filters: Filters): string {
	return FILTERS.map(({ field }) => `${field}: ${filters[field]}`).join(" · ");
}

// ---------------------------------------------------------------------------
// Reading the store
// ---------------------------------------------------------------------------

const ITEM_LABELS: ReadonlyArray<readonly [string, string]> = [
	["Epic", "epic"],
	["Module", "module"],
	["Type", "type"],
	["Priority", "priority"],
	["Status", "status"],
	["Branch", "branch"],
	["Dependencies", "dependencies"],
	["Dependency override", "dependency_override"],
	["Requirements", "requirements"],
	["Design references", "design_references"],
	["Description", "description"],
	["Found in", "found_in"],
	["Steps to reproduce", "steps_to_reproduce"],
	["Expected", "expected"],
	["Actual", "actual"],
];

function strings(value: unknown): string[] {
	return Array.isArray(value) ? value.map(String) : [];
}

function toBacklogItem(record: BacklogRecord, lookup: Lookup): BacklogItem {
	const body: string[] = [];
	for (const [label, field] of ITEM_LABELS) {
		const value = record[field];
		const text = Array.isArray(value) ? value.join(", ") : value ? String(value) : "";
		if (text) body.push(`- **${label}:** ${text}`);
		else if (field === "dependencies") body.push("- **Dependencies:** none");
	}
	body.push("- **Acceptance criteria:**", ...strings(record.acceptance_criteria).map((c) => `  - ${c}`));
	if (strings(record.remarks).length > 0) body.push("- **Remarks:**", ...strings(record.remarks).map((r) => `  - ${r}`));
	if (record.blocked_by) body.push(`- **Blocked by:** ${String(record.blocked_by)}`);
	if (record.outcome) body.push(`- **Outcome:** ${String(record.outcome)} (${String(record.closed_at)})`);

	const versionId = record.version ? String(record.version) : undefined;
	const epicId = record.epic ? String(record.epic) : undefined;
	const epicTitle = epicId ? lookup.epics.get(epicId)?.title : undefined;
	const versionState = versionId ? lookup.versions.get(versionId)?.state : undefined;
	return {
		heading: `${String(record.id)} — ${String(record.title)}`,
		version: versionId ? `Version ${versionId}` : undefined,
		versionState: versionState ? String(versionState) : undefined,
		epic: epicId ? `${epicId}${epicTitle ? ` — ${String(epicTitle)}` : ""}` : undefined,
		body,
	};
}

function byId(records: BacklogRecord[]): Map<string, BacklogRecord> {
	return new Map(records.map((record) => [String(record.id), record]));
}

function readFailure(error: unknown): string {
	const stderr = (error as { stderr?: unknown } | null)?.stderr;
	return stderr ? String(stderr).trim() : error instanceof Error ? error.message : String(error);
}

/** Items in display order (by version, then epic), with the branch they were read from. */
function toItems(store: ExportedStore, lookup: Lookup): BacklogItem[] {
	const order = (a: string | undefined, b: string | undefined) =>
		(a ?? "\uffff").localeCompare(b ?? "\uffff", undefined, { numeric: true });
	return store.items
		.map((record) => {
			const item = toBacklogItem(record, lookup);
			const origin = store.branches?.items[String(record.id)];
			if (!origin) return item;
			return { ...item, source: origin.source, alsoIn: origin.also_in.length > 0 ? origin.also_in : undefined };
		})
		.sort((a, b) => order(a.version, b.version) || order(a.epic, b.epic));
}

/** The backlog of the current directory, read synchronously so the overlay opens with it. */
function loadBacklog(cwd: string): LoadResult {
	if (!existsSync(join(cwd, BACKLOG_TOOL))) return { message: `${BACKLOG_TOOL} not found in ${cwd}.` };
	let store: ExportedStore;
	try {
		const output = execFileSync("python3", [join(cwd, BACKLOG_TOOL), "export", "--json"], {
			cwd,
			encoding: "utf8",
			timeout: READ_TIMEOUT_MS,
			maxBuffer: 32 * 1024 * 1024,
			stdio: ["ignore", "pipe", "pipe"],
		});
		store = JSON.parse(output);
	} catch (error) {
		return { message: `Cannot read the backlog: ${readFailure(error)}` };
	}
	const lookup = { versions: byId(store.versions), epics: byId(store.epics) };
	const items = toItems(store, lookup);
	if (items.length === 0) return { message: "The backlog contains no items." };
	return { items, lookup };
}

/** `export --json --branches` in the background; resolves with null on any failure. */
function exportWithBranches(cwd: string, fetch: boolean): Promise<ExportedStore | null> {
	const args = [join(cwd, BACKLOG_TOOL), "export", "--json", "--branches", ...(fetch ? [] : ["--no-fetch"])];
	return new Promise((resolve) => {
		try {
			execFile(
				"python3",
				args,
				{
					cwd,
					timeout: BRANCHES_TIMEOUT_MS,
					maxBuffer: 32 * 1024 * 1024,
					env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
				},
				(error, stdout) => {
					if (error) return resolve(null);
					try {
						resolve(JSON.parse(stdout) as ExportedStore);
					} catch {
						resolve(null);
					}
				},
			);
		} catch {
			resolve(null);
		}
	});
}

// ---------------------------------------------------------------------------
// Styling
// ---------------------------------------------------------------------------

function styleStatus(theme: Theme, value: string): string {
	const v = value.trim();
	if (/^done\b/i.test(v)) return theme.fg("success", v);
	if (/^blocked\b/i.test(v)) return theme.fg("error", v);
	if (/^in progress\b/i.test(v)) return theme.fg("accent", v);
	return theme.fg("muted", v);
}

function stylePriority(theme: Theme, value: string): string {
	const v = value.trim();
	if (/^P0\b/.test(v)) return theme.bold(theme.fg("error", v));
	if (/^P1\b/.test(v)) return theme.fg("warning", v);
	return theme.fg("muted", v);
}

/** Inline Markdown: `code` and **bold**; everything else is shown as is. */
function styleInline(theme: Theme, text: string): string {
	return text
		.replace(/`([^`]+)`/g, (_m, code: string) => theme.fg("mdCode", code))
		.replace(/\*\*([^*]+)\*\*/g, (_m, bold: string) => theme.bold(bold));
}

function styleValue(theme: Theme, label: string, value: string): string {
	const key = label.toLowerCase();
	if (key === "status") return styleStatus(theme, value);
	if (key === "priority") return stylePriority(theme, value);
	return styleInline(theme, value);
}

/** `**Label:** value · **Label:** value` → styled segments; null if the text has no field. */
function styleFields(theme: Theme, text: string): string | null {
	const re = /\*\*([^*:]+):\*\*\s*/g;
	const matches = [...text.matchAll(re)];
	if (matches.length === 0 || matches[0]!.index !== 0) return null;
	const parts: string[] = [];
	for (let i = 0; i < matches.length; i++) {
		const m = matches[i]!;
		const label = m[1]!.trim();
		const start = m.index! + m[0].length;
		const end = i + 1 < matches.length ? matches[i + 1]!.index! : text.length;
		const value = text.slice(start, end).replace(/\s*·\s*$/, "");
		parts.push(theme.fg("accent", `${label}:`) + (value ? ` ${styleValue(theme, label, value)}` : ""));
	}
	return parts.join(theme.fg("dim", " · "));
}

/** Wrap one Markdown body line to `width`, keeping list indentation as a hanging indent. */
function renderBodyLine(theme: Theme, line: string, width: number): string[] {
	if (line.trim() === "") return [""];
	const bullet = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/.exec(line);
	let indent = "";
	let marker = "";
	let content = line.trim();
	if (bullet) {
		const depth = Math.floor(bullet[1]!.replace(/\t/g, "  ").length / 2);
		indent = "  ".repeat(depth);
		marker = depth === 0 && styleFields(theme, bullet[3]!) !== null ? "" : `${theme.fg("dim", "•")} `;
		content = bullet[3]!;
	}
	const styled = styleFields(theme, content) ?? styleInline(theme, content);
	const prefixWidth = visibleWidth(indent) + visibleWidth(marker);
	const wrapped = wrapTextWithAnsi(styled, Math.max(10, width - prefixWidth));
	return wrapped.map((w, i) => (i === 0 ? indent + marker : " ".repeat(prefixWidth)) + w);
}

// ---------------------------------------------------------------------------
// Overlay component
// ---------------------------------------------------------------------------

class BacklogOverlay {
	/** Indices into the items of the ones that match the filters, in display order. */
	private matching: number[] = [];
	/** Position inside `matching`. */
	private index = 0;
	private scroll = 0;
	private bodyHeight = 10;
	private fetchState: FetchState = "none";
	private cachedWidth?: number;
	private cachedLines?: string[];

	constructor(
		private load: LoadResult,
		/** Shared with the extension, so changes survive closing and reopening the overlay. */
		private readonly filters: Filters,
		private readonly theme: Theme,
		private readonly rows: () => number,
		private readonly requestRender: () => void,
		private readonly done: () => void,
	) {
		this.applyFilters();
	}

	/** Replace the items (same base, states resolved from item branches), keeping the current item and filters. */
	setItems(items: BacklogItem[]): void {
		if ("items" in this.load) this.load = { ...this.load, items };
		this.applyFilters(true);
		this.invalidate();
		this.requestRender();
	}

	setFetchState(state: FetchState): void {
		this.fetchState = state;
		this.invalidate();
		this.requestRender();
	}

	/** Recompute the matching items; stay on the current item if it still matches, else go to the first. */
	private applyFilters(keepScroll = false): void {
		if (!("items" in this.load)) return;
		const current = this.matching[this.index];
		this.matching = [];
		this.load.items.forEach((item, i) => {
			if (matchesFilters(item, this.filters)) this.matching.push(i);
		});
		const kept = current === undefined ? -1 : this.matching.indexOf(current);
		this.index = kept >= 0 ? kept : 0;
		if (!(keepScroll && kept >= 0)) this.scroll = 0;
	}

	/** Cycle a filter on t/T, p/P, s/S; returns true if the key was a filter key. */
	private cycleFilter(data: string): boolean {
		// matchesKey covers plain, Kitty CSI-u and modifyOtherKeys encodings of the key and of shift+key.
		let step = 0;
		const filter = FILTERS.find((f) => {
			if (matchesKey(data, f.key)) step = 1;
			else if (matchesKey(data, `shift+${f.key}`)) step = -1;
			return step !== 0;
		});
		if (!filter) return false;
		const values: readonly string[] = filter.values;
		const at = Math.max(0, values.indexOf(this.filters[filter.field]));
		this.filters[filter.field] = values[(at + step + values.length) % values.length]!;
		this.applyFilters();
		return true;
	}

	invalidate(): void {
		this.cachedWidth = undefined;
		this.cachedLines = undefined;
	}

	handleInput(data: string): void {
		if (matchesKey(data, "escape") || data === "q" || data === "Q") {
			this.done();
			return;
		}
		if (!("items" in this.load)) return;
		if (this.cycleFilter(data)) {
			this.invalidate();
			this.requestRender();
			return;
		}
		const count = this.matching.length;
		if (count === 0) return;
		const before = { index: this.index, scroll: this.scroll };

		if (matchesKey(data, "left") || matchesKey(data, "up")) {
			this.index = Math.max(0, this.index - 1);
		} else if (matchesKey(data, "right") || matchesKey(data, "down")) {
			this.index = Math.min(count - 1, this.index + 1);
		} else if (matchesKey(data, "home")) {
			this.index = 0;
		} else if (matchesKey(data, "end")) {
			this.index = count - 1;
		} else if (matchesKey(data, "pageUp")) {
			this.scroll = Math.max(0, this.scroll - Math.max(1, this.bodyHeight - 1));
		} else if (matchesKey(data, "pageDown")) {
			this.scroll += Math.max(1, this.bodyHeight - 1);
		} else {
			return;
		}
		if (this.index !== before.index) this.scroll = 0;
		if (this.index !== before.index || this.scroll !== before.scroll) {
			this.invalidate();
			this.requestRender();
		}
	}

	render(width: number): string[] {
		if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;
		const th = this.theme;
		const innerW = Math.max(20, width - 2);
		const textW = innerW - 2;
		const pad = (s: string) => {
			const t = truncateToWidth(s, innerW);
			return t + " ".repeat(Math.max(0, innerW - visibleWidth(t)));
		};
		const row = (s: string) => th.fg("border", "│") + pad(s) + th.fg("border", "│");
		const rule = (left: string, right: string, title = "") => {
			const t = title ? ` ${title} ` : "";
			const fill = Math.max(0, innerW - visibleWidth(t));
			return th.fg("border", left) + th.fg("accent", t) + th.fg("border", "─".repeat(fill) + right);
		};

		// Fixed box height so the overlay does not jump between items.
		const totalHeight = Math.max(10, Math.floor(this.rows() * 0.85));
		const lines: string[] = [];

		if (!("items" in this.load)) {
			lines.push(rule("╭", "╮", "Backlog"));
			lines.push(row(""));
			for (const l of wrapTextWithAnsi(this.load.message, textW)) lines.push(row(` ${l}`));
			lines.push(row(""));
			lines.push(row(` ${th.fg("dim", "Esc/q close")}`));
			lines.push(rule("╰", "╯"));
			this.cachedWidth = width;
			this.cachedLines = lines;
			return lines;
		}

		const items = this.load.items;
		const fetchNotice =
			this.fetchState === "fetching"
				? th.fg("dim", "fetching…")
				: this.fetchState === "failed"
					? th.fg("warning", "fetch failed: showing last known state")
					: "";
		const filterLine = [th.fg("muted", describeFilters(this.filters)), fetchNotice]
			.filter(Boolean)
			.join(th.fg("dim", " · "));
		const help = th.fg("dim", "←/→ item · t/p/s filter · PgUp/PgDn scroll · Esc/q close");

		if (this.matching.length === 0) {
			lines.push(rule("╭", "╮", "Backlog"));
			lines.push(row(` ${th.bold(`0 / 0 (${items.length} total)`)}`));
			lines.push(row(` ${filterLine}`));
			lines.push(rule("├", "┤"));
			lines.push(row(""));
			lines.push(row(" No items match the filters"));
			const blank = Math.max(0, totalHeight - 9);
			for (let i = 0; i < blank; i++) lines.push(row(""));
			lines.push(rule("├", "┤"));
			lines.push(row(` ${help}`));
			lines.push(rule("╰", "╯"));
			this.cachedWidth = width;
			this.cachedLines = lines;
			return lines;
		}

		const item = items[this.matching[this.index]!]!;

		// Header: position in the filtered list, version with state, epic; then the filters.
		const position = th.bold(`${this.index + 1} / ${this.matching.length} (${items.length} total)`);
		const version = item.version
			? item.version + (item.versionState ? ` (${item.versionState})` : "")
			: "no version";
		const header = [position, th.fg("muted", version), th.fg("muted", item.epic ?? "no epic")].join(
			th.fg("dim", " · "),
		);
		const origin: string[] = [];
		if (item.source) {
			const from = th.fg("accent", `from ${item.source}`);
			const also = item.alsoIn ? th.fg("warning", `also in: ${item.alsoIn.join(", ")}`) : "";
			origin.push(...wrapTextWithAnsi([from, also].filter(Boolean).join(th.fg("dim", " · ")), textW));
		}
		const title = wrapTextWithAnsi(th.bold(styleInline(th, item.heading)), textW);

		const body: string[] = [];
		for (const l of item.body) body.push(...renderBodyLine(th, l, textW));

		const fixed = 2 /* borders */ + 2 /* header, filters */ + origin.length + 1 /* separator */ + title.length + 1 /* blank */ + 1 /* separator */ + 1 /* help */;
		this.bodyHeight = Math.max(3, totalHeight - fixed);
		const maxScroll = Math.max(0, body.length - this.bodyHeight);
		if (this.scroll > maxScroll) this.scroll = maxScroll;
		const visible = body.slice(this.scroll, this.scroll + this.bodyHeight);
		while (visible.length < this.bodyHeight) visible.push("");

		lines.push(rule("╭", "╮", "Backlog"));
		lines.push(row(` ${header}`));
		lines.push(row(` ${filterLine}`));
		for (const l of origin) lines.push(row(` ${l}`));
		lines.push(rule("├", "┤"));
		for (const l of title) lines.push(row(` ${l}`));
		lines.push(row(""));
		for (const l of visible) lines.push(row(` ${l}`));
		const range =
			maxScroll > 0
				? `lines ${this.scroll + 1}-${Math.min(body.length, this.scroll + this.bodyHeight)} of ${body.length}`
				: "";
		lines.push(rule("├", "┤", range));
		lines.push(row(` ${help}`));
		lines.push(rule("╰", "╯"));

		this.cachedWidth = width;
		this.cachedLines = lines;
		return lines;
	}
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

type ShortcutSetting = { shortcut: string | null; warning?: string };

function readSettingsFile(path: string): Record<string, unknown> | undefined {
	try {
		if (!existsSync(path)) return undefined;
		const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
		return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : undefined;
	} catch {
		return undefined;
	}
}

/**
 * Shortcut from pi's settings.json: `"backlogOverlay": { "shortcut": "alt+b" }`.
 * Project settings (`.pi/settings.json`) override global ones (agent directory),
 * like pi does. `false`, `null` or `""` disable the shortcut; `/backlog` always works.
 * Read directly because pi.getSettings() is not available while extensions load,
 * and shortcuts must be registered then.
 */
function resolveShortcut(cwd: string): ShortcutSetting {
	let value: unknown = DEFAULT_SHORTCUT;
	for (const path of [join(getAgentDir(), "settings.json"), join(cwd, CONFIG_DIR_NAME, "settings.json")]) {
		const section = readSettingsFile(path)?.backlogOverlay;
		if (section && typeof section === "object" && "shortcut" in section) {
			value = (section as Record<string, unknown>).shortcut;
		}
	}
	if (value === false || value === null || value === "") return { shortcut: null };
	if (typeof value === "string") return { shortcut: value.trim().toLowerCase() };
	return {
		shortcut: DEFAULT_SHORTCUT,
		warning: `backlogOverlay.shortcut must be a string or false; using ${DEFAULT_SHORTCUT}.`,
	};
}

/**
 * Background update of an open overlay: states from the local item branches first,
 * then, when the repository has a remote, again after the fetch. Does nothing
 * outside a git repository.
 */
async function refreshFromBranches(
	cwd: string,
	lookup: Lookup,
	overlay: BacklogOverlay,
	isClosed: () => boolean,
): Promise<void> {
	try {
		const local = await exportWithBranches(cwd, false);
		if (isClosed() || !local?.branches || local.branches.fetch === "none") return;
		overlay.setItems(toItems(local, lookup));
		if (local.branches.remotes.length === 0) return;
		overlay.setFetchState("fetching");
		const fetched = await exportWithBranches(cwd, true);
		if (isClosed()) return;
		if (!fetched?.branches || fetched.branches.fetch !== "done") {
			overlay.setFetchState("failed");
			return;
		}
		overlay.setItems(toItems(fetched, lookup));
		overlay.setFetchState("done");
	} catch {
		// Never break the overlay: it keeps showing what it has.
	}
}

export default function (pi: ExtensionAPI) {
	let open = false;
	// In memory only: kept across openings in this pi session, reset on restart or /reload.
	const filters = defaultFilters();

	const show = async (ctx: ExtensionContext) => {
		if (ctx.mode !== "tui") {
			if (ctx.hasUI) ctx.ui.notify("The backlog overlay requires the interactive TUI.", "warning");
			return;
		}
		if (open) return;
		open = true;
		try {
			// Read the file again at every opening, so the overlay always shows the current backlog.
			const cwd = ctx.cwd;
			const load = loadBacklog(cwd);
			let closed = false;
			await ctx.ui.custom<void>(
				(tui, theme, _keybindings, done) => {
					const overlay = new BacklogOverlay(
						load,
						filters,
						theme,
						() => tui.terminal.rows,
						() => tui.requestRender(),
						() => {
							closed = true;
							done();
						},
					);
					if ("items" in load) void refreshFromBranches(cwd, load.lookup, overlay, () => closed);
					return overlay;
				},
				{
					overlay: true,
					overlayOptions: { anchor: "center", width: "80%", minWidth: 50, maxHeight: "90%", margin: 1 },
				},
			);
		} finally {
			open = false;
		}
	};

	const { shortcut, warning } = resolveShortcut(process.cwd());
	if (shortcut) {
		pi.registerShortcut(shortcut, {
			description: "Browse backlog items (read-only)",
			handler: async (ctx) => show(ctx),
		});
	}
	if (warning) {
		pi.on("session_start", (_event, ctx) => {
			if (ctx.hasUI) ctx.ui.notify(`Backlog overlay: ${warning}`, "warning");
		});
	}

	pi.registerCommand("backlog", {
		description: "Browse backlog items (read-only overlay)",
		handler: async (_args, ctx) => show(ctx),
	});
}
