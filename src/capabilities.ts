import type { SessionAffinityMode } from "./config.ts";
import {
	isManagedZaiProvider,
	isPiNativeZaiProvider,
	isZaiCodingPlanAliasProvider,
	isZaiPlatformProvider,
} from "./native-zai.ts";
import type { ZaiModel } from "./zai-model.ts";

export type ProviderOwnership =
	| "pi-native"
	| "coding-plan-alias"
	| "platform"
	| "other";
export type DynamicToolMode = "deferred" | "full-list-fallback";
export type SessionAffinitySource = "none" | "pi" | "pi-zai";

export interface ZaiCapabilities {
	providerOwnership: ProviderOwnership;
	apiFamily: string;
	usesZaiThinkingFormat: boolean;
	streamsToolCalls: boolean;
	dynamicToolMode: DynamicToolMode;
	sessionAffinitySource: SessionAffinitySource;
	sessionAffinityFormat?: string;
	toolChoiceSupportedByApi: boolean;
}

type CompatBag = Record<string, unknown>;

function readCompat(model: ZaiModel | undefined): CompatBag {
	const compat = model?.compat;
	if (!compat || typeof compat !== "object") return {};
	return compat as CompatBag;
}

function resolveOwnership(provider: string | undefined): ProviderOwnership {
	if (isPiNativeZaiProvider(provider)) return "pi-native";
	if (isZaiCodingPlanAliasProvider(provider)) return "coding-plan-alias";
	if (isZaiPlatformProvider(provider)) return "platform";
	return "other";
}

function resolveDynamicToolMode(
	apiFamily: string,
	compat: CompatBag,
): DynamicToolMode {
	if (
		(apiFamily === "openai-responses" ||
			apiFamily === "openai-codex-responses") &&
		compat.supportsToolSearch === true
	) {
		return "deferred";
	}
	if (
		apiFamily === "anthropic-messages" &&
		compat.supportsToolReferences === true
	) {
		return "deferred";
	}
	return "full-list-fallback";
}

function resolveAffinitySource(
	ownership: ProviderOwnership,
	compat: CompatBag,
	sessionAffinity: SessionAffinityMode,
): { source: SessionAffinitySource; format?: string } {
	const format =
		typeof compat.sessionAffinityFormat === "string"
			? compat.sessionAffinityFormat
			: undefined;

	if (format) {
		return { source: "pi", format };
	}

	if (ownership !== "other" && sessionAffinity === "experimental") {
		return { source: "pi-zai", format: "x-session-id" };
	}

	return { source: "none", format };
}

/**
 * Normalize model/API/compat metadata for hooks and diagnostics.
 * Unknown fields fail closed toward preserving Pi-native behavior.
 */
export function resolveZaiCapabilities(
	model: ZaiModel | undefined,
	sessionAffinity: SessionAffinityMode = "off",
): ZaiCapabilities {
	const ownership = resolveOwnership(model?.provider);
	const apiFamily =
		typeof model?.api === "string" && model.api.length > 0
			? model.api
			: "unknown";
	const compat = readCompat(model);
	const affinity = resolveAffinitySource(ownership, compat, sessionAffinity);

	return {
		providerOwnership: ownership,
		apiFamily,
		usesZaiThinkingFormat: compat.thinkingFormat === "zai",
		streamsToolCalls: compat.zaiToolStream === true,
		dynamicToolMode: resolveDynamicToolMode(apiFamily, compat),
		sessionAffinitySource: affinity.source,
		sessionAffinityFormat: affinity.format,
		toolChoiceSupportedByApi:
			apiFamily === "openai-responses" ||
			apiFamily === "openai-codex-responses",
	};
}

export function isManagedZaiCapabilities(
	capabilities: ZaiCapabilities,
): boolean {
	return capabilities.providerOwnership !== "other";
}

export function usesManagedZaiProvider(model: ZaiModel | undefined): boolean {
	return isManagedZaiProvider(model?.provider);
}
