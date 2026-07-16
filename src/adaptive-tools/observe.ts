import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ZaiAdaptiveToolsConfig } from "../config.ts";
import { collectDeferredToolNames } from "./groups.ts";

export interface AdaptiveToolObservation {
	activeCount: number;
	deferredCount: number;
	estimatedDeferredSchemaBytes: number;
	configuredGroupCount: number;
}

function estimateSchemaBytes(value: unknown): number {
	try {
		return Buffer.byteLength(JSON.stringify(value ?? null), "utf8");
	} catch {
		return 0;
	}
}

export function observeAdaptiveToolImpact(
	pi: ExtensionAPI,
	config: ZaiAdaptiveToolsConfig,
): AdaptiveToolObservation {
	const active = new Set(pi.getActiveTools());
	const deferred = collectDeferredToolNames(config);
	let estimatedDeferredSchemaBytes = 0;
	for (const tool of pi.getAllTools()) {
		if (!deferred.has(tool.name)) continue;
		estimatedDeferredSchemaBytes += estimateSchemaBytes({
			name: tool.name,
			description: tool.description,
			parameters: tool.parameters,
		});
	}
	return {
		activeCount: active.size,
		deferredCount: [...deferred].filter((name) => active.has(name)).length,
		estimatedDeferredSchemaBytes,
		configuredGroupCount: Object.keys(config.groups).length,
	};
}
