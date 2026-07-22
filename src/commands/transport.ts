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
		formatKeyValue("Logical turns", summary.attempts),
		formatKeyValue("Terminal errors", summary.errors),
		formatKeyValue(
			"Avg request → headers",
			formatMs(summary.avgRequestToHeadersMs),
		),
		formatKeyValue(
			"Avg turn → first delta",
			formatMs(summary.avgRequestToFirstDeltaMs),
		),
		formatKeyValue(
			"Avg turn → first tool",
			formatMs(summary.avgRequestToFirstToolDeltaMs),
		),
		formatKeyValue("Avg turn wall", formatMs(summary.avgTotalMs)),
	];
	if (summary.totalToolCalls > 0) {
		lines.push(
			formatKeyValue(
				"Tool executions",
				`${summary.totalToolCalls}${summary.totalToolErrors > 0 ? ` (${summary.totalToolErrors} errors)` : ""}`,
			),
			formatKeyValue(
				"Avg tool time per turn",
				formatMs(summary.avgToolDurationMs),
			),
		);
	}

	const categories = Object.entries(summary.errorCategories).sort(
		(left, right) => right[1] - left[1],
	);
	if (categories.length > 0) {
		lines.push(
			...formatSection(
				"Terminal error categories",
				categories.map(([category, count]) => `${category}: ${count}`),
			),
		);
	}

	lines.push(
		"",
		"Scope note: one stored row represents one completed agent turn. Retry attempts inside that turn are not separate rows; the attempt field records the final attempt number.",
		"Tool time is the summed tool wall time per stored turn, not mean latency per individual tool execution.",
	);

	return joinCommandLines(lines);
}

export function registerZaiTransportCommand(pi: ExtensionAPI): void {
	pi.registerCommand("zai-transport", {
		description: "Local transport latency and terminal error summary",
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
