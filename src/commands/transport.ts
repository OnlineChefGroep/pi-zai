import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getMetricsStorage, sessionState } from "../state.ts";
import { projectIdForCwd } from "../storage/project-id.ts";
import type { TransportSummary } from "../storage/types.ts";
import {
	formatHeading,
	formatKeyValue,
	formatMs,
	formatSection,
	joinCommandLines,
} from "./format.ts";

function formatTransportSummary(summary: TransportSummary): string {
	const lines = [
		...formatHeading("Z.AI transport"),
		formatKeyValue("Attempts", summary.attempts),
		formatKeyValue("Errors", summary.errors),
		formatKeyValue("Avg headers", formatMs(summary.avgRequestToHeadersMs)),
		formatKeyValue(
			"Avg first delta",
			formatMs(summary.avgRequestToFirstDeltaMs),
		),
		formatKeyValue(
			"Avg first tool",
			formatMs(summary.avgRequestToFirstToolDeltaMs),
		),
		formatKeyValue("Avg total", formatMs(summary.avgTotalMs)),
	];

	const categories = Object.entries(summary.errorCategories).sort(
		(left, right) => right[1] - left[1],
	);
	if (categories.length > 0) {
		lines.push(
			...formatSection(
				"Error categories",
				categories.map(([category, count]) => `${category}: ${count}`),
			),
		);
	}

	return joinCommandLines(lines);
}

export function registerZaiTransportCommand(pi: ExtensionAPI): void {
	pi.registerCommand("zai-transport", {
		description: "Local transport latency and error-category summary",
		handler: async (_args, ctx) => {
			const storage = getMetricsStorage();
			if (!storage) {
				ctx.ui.notify("Local metrics storage is not initialized.", "warning");
				return;
			}

			const projectId = sessionState.projectId ?? projectIdForCwd(ctx.cwd);
			const summary = storage.getTransportSummary({ projectId });
			ctx.ui.notify(formatTransportSummary(summary), "info");
		},
	});
}
