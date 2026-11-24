/**
 * Template check — tells the user when the project is behind the template.
 *
 * When pi starts (not on /reload, /new, /resume or a fork) it runs
 * `backlog template-check --format json` in the background and, if a newer
 * release of the template exists, shows its message as a warning. The CLI
 * compares the `Process version` of docs/PROCESS.md with the latest `vX.Y.Z`
 * tag of the `Template` named there; the Claude Code SessionStart hook in
 * .claude/settings.json shows the same message.
 *
 * Project-agnostic and silent on failure: offline, without python3 or without
 * the CLI nothing is shown. It never writes any file and never blocks startup.
 */

import { execFile } from "node:child_process";
import { join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const BACKLOG_TOOL = join(".agents", "tools", "backlog.py");
/** The CLI gives git 5 s to list the tags of the template. */
const CHECK_TIMEOUT_MS = 15_000;

interface TemplateCheck {
	state: "current" | "behind" | "unknown";
	message: string;
}

export default function (pi: ExtensionAPI) {
	pi.on("session_start", (event, ctx) => {
		if (event.reason !== "startup" || !ctx.hasUI) return;
		execFile(
			"python3",
			[join(ctx.cwd, BACKLOG_TOOL), "template-check", "--format", "json"],
			{ cwd: ctx.cwd, timeout: CHECK_TIMEOUT_MS, env: { ...process.env, GIT_TERMINAL_PROMPT: "0" } },
			(error, stdout) => {
				if (error) return;
				try {
					const report = JSON.parse(stdout) as TemplateCheck;
					if (report.state === "behind") ctx.ui.notify(report.message, "warning");
				} catch {
					// Never disturb the session: no notice.
				}
			},
		);
	});
}
