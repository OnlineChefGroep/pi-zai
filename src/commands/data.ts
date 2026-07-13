import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getMetricsStorage, sessionState } from "../state.ts";
import {
	clearLocalProjectSecret,
	projectIdForCwd,
} from "../storage/project-id.ts";
import type { ZaiCommandDeps } from "./deps.ts";
import {
	formatBytes,
	formatHeading,
	formatKeyValue,
	formatSection,
	joinCommandLines,
} from "./format.ts";
import { formatPercent } from "./helpers.ts";

function resolveProjectId(cwd: string): string {
	return sessionState.projectId ?? projectIdForCwd(cwd);
}

const ACTIONS = [
	"status",
	"clear-project",
	"clear-details",
	"clear-benchmarks",
	"clear-all",
	"export-json",
	"export-csv",
	"vacuum",
] as const;

function formatStatus(cwd: string): string {
	const storage = getMetricsStorage();
	if (!storage) {
		return "Local metrics storage is not initialized.";
	}

	const projectId = resolveProjectId(cwd);
	const status = storage.getStatus();
	const summary = storage.getUsageSummary({ projectId });
	const lines = [
		...formatHeading("Z.AI local metrics"),
		formatKeyValue(
			"Storage",
			`${status.kind}${status.degraded ? " (degraded)" : ""}`,
		),
		formatKeyValue("Location", status.location ?? "memory"),
		formatKeyValue("Database size", formatBytes(status.databaseBytes)),
		...formatSection("Rows", [
			`Detail: ${status.detailRows}`,
			`Rollup: ${status.rollupRows}`,
			`Benchmark: ${status.benchmarkRows}`,
		]),
		...formatSection("Scope", [
			`Project hash: ${projectId}`,
			`Session hash: ${sessionState.sessionHash ?? "unknown"}`,
		]),
		...formatSection("Project usage", [
			`Attempts: ${summary.attempts}`,
			`Cache hit ratio: ${summary.cacheHitRatio > 0 ? formatPercent(summary.cacheHitRatio) : "n/a"}`,
		]),
	];
	return joinCommandLines(lines);
}

export function registerZaiDataCommand(
	pi: ExtensionAPI,
	_deps: ZaiCommandDeps,
): void {
	pi.registerCommand("zai-data", {
		description: "Local Z.AI metrics storage (status, wipe, export)",
		getArgumentCompletions: (prefix) => {
			const matches = ACTIONS.filter((value) => value.startsWith(prefix));
			return matches.length > 0
				? matches.map((value) => ({ value, label: value }))
				: null;
		},
		handler: async (args, ctx) => {
			const storage = getMetricsStorage();
			if (!storage) {
				ctx.ui.notify("Local metrics storage is not initialized.", "warning");
				return;
			}

			const [action, ...rest] = args.trim().split(/\s+/);
			const normalized = action === "" ? "status" : action.toLowerCase();

			switch (normalized) {
				case "status":
					ctx.ui.notify(formatStatus(ctx.cwd), "info");
					return;
				case "clear-project": {
					const projectId = resolveProjectId(ctx.cwd);
					storage.clearProject(projectId);
					ctx.ui.notify(
						`Cleared local metrics for project ${projectId}.`,
						"info",
					);
					return;
				}
				case "clear-details":
					storage.clearDetails();
					ctx.ui.notify(
						"Cleared detailed attempt rows (rollups retained).",
						"info",
					);
					return;
				case "clear-benchmarks":
					storage.clearBenchmarks();
					ctx.ui.notify("Cleared benchmark rows.", "info");
					return;
				case "clear-all":
					storage.clearAll();
					clearLocalProjectSecret();
					sessionState.projectId = undefined;
					ctx.ui.notify(
						"Cleared all local pi-zai metrics and rotated the local project secret.",
						"info",
					);
					return;
				case "export-json":
				case "export-csv": {
					const pathArg = rest.join(" ").trim();
					if (!pathArg) {
						ctx.ui.notify(`Usage: /zai-data ${normalized} <path>`, "warning");
						return;
					}
					const format = normalized === "export-json" ? "json" : "csv";
					const projectId = resolveProjectId(ctx.cwd);
					const payload = storage.exportData(format, { projectId });
					const target = resolve(ctx.cwd, pathArg);
					writeFileSync(target, payload, "utf-8");
					ctx.ui.notify(
						`Exported ${format.toUpperCase()} metrics to ${target}`,
						"info",
					);
					return;
				}
				case "vacuum":
					storage.vacuum();
					ctx.ui.notify("Vacuum completed.", "info");
					return;
				default:
					ctx.ui.notify(
						`Unknown action "${normalized}". Try: ${ACTIONS.join(", ")}`,
						"warning",
					);
			}
		},
	});
}
