import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ZaiAdaptiveToolsConfig } from "../config.ts";
import { sessionState } from "../state.ts";
import {
	collectDeferredToolNames,
	resolveExistingToolNames,
} from "./groups.ts";
import { registerAdaptiveLoaderTool } from "./loader-tool.ts";
import { observeAdaptiveToolImpact } from "./observe.ts";
import { LOADER_TOOL_NAME } from "./types.ts";

export interface AdaptiveToolsSessionPolicy {
	apply(): void;
	restore(): void;
}

function sameNames(left: string[], right: string[]): boolean {
	if (left.length !== right.length) return false;
	return left.every((name, index) => name === right[index]);
}

function configSignature(config: ZaiAdaptiveToolsConfig): string {
	const groups = Object.keys(config.groups)
		.sort((left, right) => left.localeCompare(right))
		.map((name) => [name, config.groups[name]] as const);
	return JSON.stringify({
		mode: config.mode,
		alwaysActive: config.alwaysActive,
		groups,
	});
}

export function createAdaptiveToolsSessionPolicy(
	pi: ExtensionAPI,
	getConfig: () => ZaiAdaptiveToolsConfig,
): AdaptiveToolsSessionPolicy {
	let loaderRegistered = false;
	let active = false;
	let activeSignature: string | undefined;
	let baselineActive = new Set<string>();
	let controlledNames = new Set<string>();
	const loadedNames = new Set<string>();

	const updateState = (
		config: ZaiAdaptiveToolsConfig,
		observation = sessionState.adaptiveTools?.observation,
	): void => {
		sessionState.adaptiveTools = {
			mode: config.mode,
			loaderInvocations: sessionState.adaptiveTools?.loaderInvocations ?? 0,
			lastAddedCount: sessionState.adaptiveTools?.lastAddedCount ?? 0,
			observation,
		};
	};

	const setActiveToolsIfChanged = (next: Set<string>): void => {
		const current = pi.getActiveTools();
		const normalized = [...next];
		if (!sameNames(current, normalized)) {
			pi.setActiveTools(normalized);
		}
	};

	const clearRuntimeState = (): void => {
		active = false;
		activeSignature = undefined;
		baselineActive = new Set();
		controlledNames = new Set();
		loadedNames.clear();
	};

	const restore = (): void => {
		if (!active) return;
		try {
			const next = new Set(pi.getActiveTools());
			for (const name of controlledNames) {
				if (baselineActive.has(name)) next.add(name);
				else next.delete(name);
			}
			setActiveToolsIfChanged(next);
		} catch {
			// Fail open: restoration must never block model switches or shutdown.
		} finally {
			clearRuntimeState();
		}
	};

	const apply = (): void => {
		const config = getConfig();
		const signature = configSignature(config);
		if (active && activeSignature === signature) {
			return;
		}
		if (active) restore();

		const observation = observeAdaptiveToolImpact(pi, config);
		updateState(config, observation);

		if (config.mode === "off" || config.mode === "observe") {
			return;
		}
		if (config.mode !== "manual") return;

		baselineActive = new Set(pi.getActiveTools());
		if (!loaderRegistered) {
			registerAdaptiveLoaderTool(pi, getConfig, (toolNames) => {
				for (const name of toolNames) loadedNames.add(name);
			});
			loaderRegistered = true;
		}

		const deferred = collectDeferredToolNames(config);
		controlledNames = new Set([...deferred, LOADER_TOOL_NAME]);
		const next = new Set(pi.getActiveTools());
		for (const name of deferred) {
			if (!loadedNames.has(name)) next.delete(name);
		}
		for (const name of resolveExistingToolNames(pi, config.alwaysActive)) {
			next.add(name);
		}
		next.add(LOADER_TOOL_NAME);
		setActiveToolsIfChanged(next);
		active = true;
		activeSignature = signature;
	};

	return { apply, restore };
}
