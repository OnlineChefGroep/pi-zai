import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
	type CanonicalToolFingerprint,
	canonicalizeToolParts,
	fingerprintCanonicalToolset,
} from "./fingerprint.ts";

export type ToolsetTransitionClass =
	| "unchanged"
	| "tools-added"
	| "tools-removed"
	| "tool-schema-changed"
	| "tool-description-changed"
	| "toolset-reordered-only"
	| "unknown-change";

export type ToolsetSnapshot = {
	count: number;
	fingerprint: string;
	tools: CanonicalToolFingerprint[];
};

export type ToolsetTransition = {
	classification: ToolsetTransitionClass;
	previousCount: number;
	nextCount: number;
	addedCount: number;
	removedCount: number;
	changed: boolean;
};

export function captureActiveToolset(
	pi: ExtensionAPI,
): ToolsetSnapshot | undefined {
	try {
		const active = new Set(pi.getActiveTools());
		const tools = pi
			.getAllTools()
			.filter((tool) => active.has(tool.name))
			.map((tool) =>
				canonicalizeToolParts({
					name: tool.name,
					description: tool.description,
					parameters: tool.parameters,
				}),
			)
			.sort((left, right) => left.name.localeCompare(right.name));
		return {
			count: tools.length,
			fingerprint: fingerprintCanonicalToolset(tools),
			tools,
		};
	} catch {
		return undefined;
	}
}

export function classifyToolsetTransition(
	previous: ToolsetSnapshot | undefined,
	next: ToolsetSnapshot,
): ToolsetTransition {
	if (!previous) {
		return {
			classification: "unchanged",
			previousCount: next.count,
			nextCount: next.count,
			addedCount: 0,
			removedCount: 0,
			changed: false,
		};
	}

	if (previous.fingerprint === next.fingerprint) {
		return {
			classification: "unchanged",
			previousCount: previous.count,
			nextCount: next.count,
			addedCount: 0,
			removedCount: 0,
			changed: false,
		};
	}

	const previousByName = new Map(
		previous.tools.map((tool) => [tool.name, tool]),
	);
	const nextByName = new Map(next.tools.map((tool) => [tool.name, tool]));

	let addedCount = 0;
	let removedCount = 0;
	let schemaChanged = false;
	let descriptionChanged = false;

	for (const name of nextByName.keys()) {
		if (!previousByName.has(name)) addedCount += 1;
	}
	for (const name of previousByName.keys()) {
		if (!nextByName.has(name)) removedCount += 1;
	}

	for (const [name, nextTool] of nextByName) {
		const previousTool = previousByName.get(name);
		if (!previousTool) continue;
		if (previousTool.parameters !== nextTool.parameters) {
			schemaChanged = true;
		} else if (previousTool.description !== nextTool.description) {
			descriptionChanged = true;
		}
	}

	const sameNames =
		addedCount === 0 &&
		removedCount === 0 &&
		previous.tools.length === next.tools.length;

	let classification: ToolsetTransitionClass;
	if (sameNames && !schemaChanged && !descriptionChanged) {
		classification = "toolset-reordered-only";
	} else if (
		addedCount > 0 &&
		removedCount === 0 &&
		!schemaChanged &&
		!descriptionChanged
	) {
		classification = "tools-added";
	} else if (
		removedCount > 0 &&
		addedCount === 0 &&
		!schemaChanged &&
		!descriptionChanged
	) {
		classification = "tools-removed";
	} else if (schemaChanged) {
		classification = "tool-schema-changed";
	} else if (descriptionChanged) {
		classification = "tool-description-changed";
	} else {
		classification = "unknown-change";
	}

	const changed = classification !== "toolset-reordered-only";

	return {
		classification: changed ? classification : "unchanged",
		previousCount: previous.count,
		nextCount: next.count,
		addedCount,
		removedCount,
		changed,
	};
}
