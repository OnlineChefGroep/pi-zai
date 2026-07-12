import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getMetricsStorage, sessionState } from "../state.ts";
import { projectIdForCwd } from "../storage/index.ts";

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

type DataAction = (typeof ACTIONS)[number];

function parseAction(args: string): { action: DataAction; rest: string } {
	const trimmed = args.trim();
	if (trimmed === "") return { action: "status", rest: "" };
	const separator = trimmed.search(/\s/);
	const action = (separator === -1 ? trimmed : trimmed.slice(0, separator)).toLowerCase();
	const rest = separator === -1 ? "" : trimmed.slice(separator).trim();
	return {
		action: ACTIONS.includes(action as DataAction) ? (action as DataAction) : "status",
		rest,
	};
}

function formatBytes(bytes: number | undefined): string {
	if (bytes === undefined) return "n/a";
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function formatTimestamp(value: number | undefined): string {
	return value === undefined ? "never" : new Date(value).toISOString();
}

export function registerZaiDataCommand(pi: ExtensionAPI): void {
	pi.registerCommand("zai-data", {
		description: "Manage local pi-zai metrics (status, clear, export, vacuum)",
		getArgumentCompletions: (prefix) => {
			const matches = ACTIONS.filter((value) => value.startsWith(prefix));
			return matches.length > 0 ? matches.map((value) => ({ value, label: value })) : null;
		},
		handler: async (args, ctx) => {
			const { action, rest } = parseAction(args);
			const storage = getMetricsStorage();
			const projectId = sessionState.projectId ?? projectIdForCwd(ctx.cwd);

			if (action === "status") {
				const status = storage.getStatus();
				const summary = storage.getUsageSummary();
				ctx.ui.notify(
					[
						"Z.AI local data",
						"",
						`Backend: ${status.kind}${status.degraded ? " (degraded)" : ""}`,
						`Location: ${status.location ?? "memory only"}`,
						`Database size: ${formatBytes(status.databaseBytes)}`,
						`Detailed attempts: ${status.detailRows}`,
						`Daily rollups: ${status.rollupRows}`,
						`Benchmarks: ${status.benchmarkRows}`,
						`Last cleanup: ${formatTimestamp(status.lastCleanupAt)}`,
						"",
						`Recorded input: ${summary.inputTokens}`,
						`Recorded cache read: ${summary.cacheReadTokens}`,
						`Recorded output: ${summary.outputTokens}`,
					].join("\n"),
					"info",
				);
				return;
			}

			if (action === "export-json" || action === "export-csv") {
				if (!rest) {
					ctx.ui.notify(`Usage: /zai-data ${action} <path>`, "warning");
					return;
				}
				const outputPath = resolve(ctx.cwd, rest);
				mkdirSync(dirname(outputPath), { recursive: true });
				writeFileSync(outputPath, storage.exportData(action === "export-json" ? "json" : "csv"), "utf-8");
				ctx.ui.notify(`Exported privacy-reduced pi-zai metrics to ${outputPath}`, "info");
				return;
			}

			if (action === "vacuum") {
				storage.vacuum();
				ctx.ui.notify("Local pi-zai metrics database vacuum completed.", "info");
				return;
			}

			const labels: Record<Exclude<DataAction, "status" | "export-json" | "export-csv" | "vacuum">, string> = {
				"clear-project": "Delete local metrics for the current project?",
				"clear-details": "Delete all detailed local attempt rows while keeping daily rollups?",
				"clear-benchmarks": "Delete all local benchmark records?",
				"clear-all": "Delete all local pi-zai metrics and recreate an empty database?",
			};
			const confirmed = await ctx.ui.confirm("pi-zai local data", labels[action]);
			if (!confirmed) return;

			if (action === "clear-project") storage.clearProject(projectId);
			if (action === "clear-details") storage.clearDetails();
			if (action === "clear-benchmarks") storage.clearBenchmarks();
			if (action === "clear-all") storage.clearAll();
			ctx.ui.notify(`Completed /zai-data ${action}.`, "info");
		},
	});
}
