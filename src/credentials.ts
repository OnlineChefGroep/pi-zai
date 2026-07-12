import type { ModelRegistry } from "@earendil-works/pi-coding-agent";

export const PLATFORM_PRIMARY_ENV = "ZAI_PLATFORM_API_KEY";
export const PLATFORM_FALLBACK_ENV = "ZAI_API_KEY";
export const CODING_PRIMARY_ENV = "ZAI_API_KEY";
export const CODING_CN_PRIMARY_ENV = "ZAI_CODING_CN_API_KEY";

export type CredentialSourceName =
	| typeof PLATFORM_PRIMARY_ENV
	| typeof PLATFORM_FALLBACK_ENV
	| typeof CODING_PRIMARY_ENV
	| typeof CODING_CN_PRIMARY_ENV
	| "stored"
	| "runtime"
	| "models_json_command"
	| "models_json_key"
	| "none";

function envVarConfigured(name: string): boolean {
	const value = process.env[name];
	return typeof value === "string" && value.trim().length > 0;
}

function authStatusSourceName(
	provider: string,
	modelRegistry: ModelRegistry | undefined,
): CredentialSourceName | undefined {
	const status = modelRegistry?.getProviderAuthStatus(provider);
	if (!status?.configured) return undefined;
	if (status.source === "environment" && status.label) {
		return status.label as CredentialSourceName;
	}
	if (status.source === "stored") return "stored";
	if (status.source === "runtime") return "runtime";
	if (status.source === "models_json_command") return "models_json_command";
	if (status.source === "models_json_key") return "models_json_key";
	return undefined;
}

/** Resolve platform credential source by name only; never returns secret values. */
export function resolvePlatformCredentialSource(modelRegistry?: ModelRegistry): CredentialSourceName {
	if (envVarConfigured(PLATFORM_PRIMARY_ENV)) return PLATFORM_PRIMARY_ENV;
	if (envVarConfigured(PLATFORM_FALLBACK_ENV)) return PLATFORM_FALLBACK_ENV;
	return authStatusSourceName("zai-platform", modelRegistry) ?? "none";
}

/** Resolve coding-plan credential source by name only; never returns secret values. */
export function resolveCodingCredentialSource(
	provider: "zai" | "zai-coding-cn",
	modelRegistry?: ModelRegistry,
): CredentialSourceName {
	if (provider === "zai-coding-cn") {
		if (envVarConfigured(CODING_CN_PRIMARY_ENV)) return CODING_CN_PRIMARY_ENV;
		return authStatusSourceName(provider, modelRegistry) ?? "none";
	}
	if (envVarConfigured(CODING_PRIMARY_ENV)) return CODING_PRIMARY_ENV;
	return authStatusSourceName(provider, modelRegistry) ?? "none";
}

export function resolveCredentialSourceForProvider(
	provider: string,
	modelRegistry?: ModelRegistry,
): CredentialSourceName {
	if (provider === "zai-platform") return resolvePlatformCredentialSource(modelRegistry);
	if (provider === "zai-coding-cn") return resolveCodingCredentialSource("zai-coding-cn", modelRegistry);
	if (provider === "zai") return resolveCodingCredentialSource("zai", modelRegistry);
	return "none";
}

/**
 * Shell-backed apiKey for registerProvider fallback.
 * Priority: ZAI_PLATFORM_API_KEY > ZAI_API_KEY (never OPENAI_API_KEY).
 */
export function buildPlatformApiKeyCommand(): string {
	return `!if [ -n "$${PLATFORM_PRIMARY_ENV}" ]; then printf '%s' "$${PLATFORM_PRIMARY_ENV}"; elif [ -n "$${PLATFORM_FALLBACK_ENV}" ]; then printf '%s' "$${PLATFORM_FALLBACK_ENV}"; fi`;
}
