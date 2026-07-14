import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { ZaiAdaptiveToolsConfig } from "../config.ts";
import { sessionState } from "../state.ts";
import {
	listConfiguredGroups,
	resolveExistingToolNames,
	resolveGroupTools,
} from "./groups.ts";
import { type AdaptiveLoadResult, LOADER_TOOL_NAME } from "./types.ts";

const LOADER_PARAMS = Type.Object({
	group: Type.String({
		description:
			"Configured tool group name to activate additively for this session",
	}),
});

export function registerAdaptiveLoaderTool(
	pi: ExtensionAPI,
	getConfig: () => ZaiAdaptiveToolsConfig,
	onLoaded: (toolNames: string[]) => void = () => {},
): void {
	pi.registerTool({
		name: LOADER_TOOL_NAME,
		label: "Z.AI Load Tools",
		description:
			"Activate a configured Z.AI tool group for the rest of this session. Use only group names from configuration.",
		parameters: LOADER_PARAMS,
		async execute(_toolCallId, params) {
			const config = getConfig();
			const group = String(params.group ?? "").trim();
			const groups = listConfiguredGroups(config);
			if (!group) {
				return {
					content: [
						{
							type: "text" as const,
							text: `Missing group. Available groups: ${groups.join(", ") || "(none configured)"}`,
						},
					],
					details: {
						requested: [],
						added: [],
						alreadyActive: [],
						unknown: [],
					} satisfies AdaptiveLoadResult,
				};
			}

			const requested = resolveGroupTools(config, group);
			if (!requested) {
				return {
					content: [
						{
							type: "text" as const,
							text: `Unknown group "${group}". Available groups: ${groups.join(", ") || "(none configured)"}`,
						},
					],
					details: {
						requested: [],
						added: [],
						alreadyActive: [],
						unknown: [group],
					} satisfies AdaptiveLoadResult,
				};
			}

			const existing = resolveExistingToolNames(pi, requested);
			const unknown = requested.filter((name) => !existing.includes(name));
			const active = pi.getActiveTools();
			const activeSet = new Set(active);
			const added = existing.filter((name) => !activeSet.has(name));
			const alreadyActive = existing.filter((name) => activeSet.has(name));

			if (added.length > 0) {
				pi.setActiveTools([...new Set([...active, ...added])]);
				onLoaded(added);
			}

			if (!sessionState.adaptiveTools) {
				sessionState.adaptiveTools = {
					mode: config.mode,
					loaderInvocations: 0,
					lastAddedCount: 0,
				};
			}
			sessionState.adaptiveTools.loaderInvocations += 1;
			sessionState.adaptiveTools.lastAddedCount = added.length;

			const summary =
				added.length > 0
					? `Loaded tools for group "${group}": ${added.join(", ")}`
					: `Group "${group}" already active${unknown.length ? `; unknown: ${unknown.join(", ")}` : ""}`;

			return {
				content: [{ type: "text" as const, text: summary }],
				details: {
					requested: existing,
					added,
					alreadyActive,
					unknown,
				} satisfies AdaptiveLoadResult,
			};
		},
	});
}
