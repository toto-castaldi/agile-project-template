/**
 * Backlog overlay — read-only browser for the items of BACKLOG.md.
 *
 * Open with ctrl+shift+b or /backlog. The shortcut can be changed in pi's
 * settings.json (global or project): `"backlogOverlay": { "shortcut": "alt+b" }`,
 * or disabled with `false`. One item per screen:
 *   ←/→ or ↑/↓  previous / next item (BACKLOG.md order, across epics and versions)
 *   Home/End    first / last item
 *   t/T         next / previous Type filter     (all, User Story, Task, Spike, Bug)
 *   p/P         next / previous Priority filter (all, P0, P1, P2)
 *   s/S         next / previous Status filter   (all, Todo, In Progress, Blocked, Done)
 *   PgUp/PgDn   scroll the current item
 *   Esc or q    close
 *
 * Navigation visits only the items that match all three filters. The filters
 * start as `Type: all · Priority: all · Status: Todo`, are kept in memory for
 * the rest of the pi session and reset when pi restarts or on /reload.
 *
 * Project-agnostic: it relies only on the structural labels of BACKLOG.md
 * defined in docs/PROCESS.md §4 (`## Version vX.Y.Z`, `**State:**`,
 * `### EPIC-NNN — …`, `#### <ID> — <title>`, `- **Field:** value`).
 * It never writes any file.
 */

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

const BACKLOG_FILE = "BACKLOG.md";
const DEFAULT_SHORTCUT = "ctrl+shift+b";

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
}

type LoadResult = { items: BacklogItem[] } | { message: string };

// ---------------------------------------------------------------------------
// Filters (values and order from docs/PROCESS.md §4.3, §4.5, §4.6)
// ---------------------------------------------------------------------------

const ALL = "all";

const FILTERS = [
	{ key: "t", field: "Type", values: [ALL, "User Story", "Task", "Spike", "Bug"] },
	{ key: "p", field: "Priority", values: [ALL, "P0", "P1", "P2"] },
	{ key: "s", field: "Status", values: [ALL, "Todo", "In Progress", "Blocked", "Done"] },
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
// Parsing
// ---------------------------------------------------------------------------

function parseBacklog(text: string): BacklogItem[] {
	const items: BacklogItem[] = [];
	let version: string | undefined;
	let versionState: string | undefined;
	let epic: string | undefined;
	let current: BacklogItem | undefined;
	let inFence = false;

	for (const rawLine of text.split(/\r?\n/)) {
		const line = rawLine.replace(/\s+$/, "");

		if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
		const heading = inFence ? null : /^(#{1,6})\s+(.*)$/.exec(line);

		if (heading) {
			const level = heading[1]!.length;
			const title = heading[2]!.trim();
			if (level <= 4) current = undefined;
			if (level <= 2) {
				const isVersion = /^Version\s+v?\d/i.test(title);
				version = isVersion ? title : undefined;
				versionState = undefined;
				epic = undefined;
			} else if (level === 3) {
				epic = title;
			} else if (level === 4) {
				current = { heading: title, version, versionState, epic, body: [] };
				items.push(current);
			}
			if (level <= 4) continue;
		}

		if (current) {
			current.body.push(line);
		} else if (version && !inFence) {
			const state = /^\*\*State:\*\*\s*(.*)$/.exec(line.trim());
			if (state) versionState = state[1]!.trim();
		}
	}

	for (const item of items) {
		while (item.body.length > 0 && item.body[0]!.trim() === "") item.body.shift();
		while (item.body.length > 0 && item.body[item.body.length - 1]!.trim() === "") item.body.pop();
	}
	return items;
}

function loadBacklog(cwd: string): LoadResult {
	const path = join(cwd, BACKLOG_FILE);
	if (!existsSync(path)) return { message: `${BACKLOG_FILE} not found in ${cwd}.` };
	let text: string;
	try {
		text = readFileSync(path, "utf8");
	} catch (error) {
		return { message: `Cannot read ${BACKLOG_FILE}: ${error instanceof Error ? error.message : String(error)}` };
	}
	const items = parseBacklog(text);
	if (items.length === 0) return { message: `${BACKLOG_FILE} contains no items.` };
	return { items };
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
	/** Indices into the items of the ones that match the filters, in BACKLOG.md order. */
	private matching: number[] = [];
	/** Position inside `matching`. */
	private index = 0;
	private scroll = 0;
	private bodyHeight = 10;
	private cachedWidth?: number;
	private cachedLines?: string[];

	constructor(
		private readonly load: LoadResult,
		/** Shared with the extension, so changes survive closing and reopening the overlay. */
		private readonly filters: Filters,
		private readonly theme: Theme,
		private readonly rows: () => number,
		private readonly requestRender: () => void,
		private readonly done: () => void,
	) {
		this.applyFilters();
	}

	/** Recompute the matching items; stay on the current item if it still matches, else go to the first. */
	private applyFilters(): void {
		if (!("items" in this.load)) return;
		const current = this.matching[this.index];
		this.matching = [];
		this.load.items.forEach((item, i) => {
			if (matchesFilters(item, this.filters)) this.matching.push(i);
		});
		const kept = current === undefined ? -1 : this.matching.indexOf(current);
		this.index = kept >= 0 ? kept : 0;
		this.scroll = 0;
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
		const filterLine = th.fg("muted", describeFilters(this.filters));
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
		const title = wrapTextWithAnsi(th.bold(styleInline(th, item.heading)), textW);

		const body: string[] = [];
		for (const l of item.body) body.push(...renderBodyLine(th, l, textW));

		const fixed = 2 /* borders */ + 2 /* header, filters */ + 1 /* separator */ + title.length + 1 /* blank */ + 1 /* separator */ + 1 /* help */;
		this.bodyHeight = Math.max(3, totalHeight - fixed);
		const maxScroll = Math.max(0, body.length - this.bodyHeight);
		if (this.scroll > maxScroll) this.scroll = maxScroll;
		const visible = body.slice(this.scroll, this.scroll + this.bodyHeight);
		while (visible.length < this.bodyHeight) visible.push("");

		lines.push(rule("╭", "╮", "Backlog"));
		lines.push(row(` ${header}`));
		lines.push(row(` ${filterLine}`));
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
			const load = loadBacklog(ctx.cwd);
			await ctx.ui.custom<void>(
				(tui, theme, _keybindings, done) =>
					new BacklogOverlay(
						load,
						filters,
						theme,
						() => tui.terminal.rows,
						() => tui.requestRender(),
						() => done(),
					),
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
			description: "Browse BACKLOG.md items (read-only)",
			handler: async (ctx) => show(ctx),
		});
	}
	if (warning) {
		pi.on("session_start", (_event, ctx) => {
			if (ctx.hasUI) ctx.ui.notify(`Backlog overlay: ${warning}`, "warning");
		});
	}

	pi.registerCommand("backlog", {
		description: "Browse BACKLOG.md items (read-only overlay)",
		handler: async (_args, ctx) => show(ctx),
	});
}
