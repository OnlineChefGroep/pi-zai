import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ZaiAdaptiveToolsConfig } from "../config.ts";
import { LOADER_TOOL_NAME } from "./types.ts";

export function resolveExistingToolNames(
	pi: ExtensionAPI,
	names: string[],
): string[] {
	const available = new Set(pi.getAllTools().map((tool) => tool.name));
	return names.filter(
		(name) => available.has(name) || name === LOADER_TOOL_NAME,
	);
}

export function collectDeferredToolNames(
	config: ZaiAdaptiveToolsConfig,
): Set<string> {
	const deferred = new Set<string>();
	for (const tools of Object.values(config.groups)) {
		for (const name of tools) deferred.add(name);
	}
	for (const name of config.alwaysActive) {
		deferred.delete(name);
	}
	deferred.delete(LOADER_TOOL_NAME);
	return deferred;
}

export function resolveGroupTools(
	config: ZaiAdaptiveToolsConfig,
	group: string,
): string[] | undefined {
	const tools = config.groups[group];
	return tools ? [...tools] : undefined;
}

export function listConfiguredGroups(config: ZaiAdaptiveToolsConfig): string[] {
	return Object.keys(config.groups).sort((a, b) => a.localeCompare(b));
}
