import type { ModelRegistry } from "@earendil-works/pi-coding-agent";
export declare const PLATFORM_PRIMARY_ENV = "ZAI_PLATFORM_API_KEY";
export declare const PLATFORM_FALLBACK_ENV = "ZAI_API_KEY";
export declare const CODING_PRIMARY_ENV = "ZAI_API_KEY";
export declare const CODING_CN_PRIMARY_ENV = "ZAI_CODING_CN_API_KEY";
export type CredentialSourceName = typeof PLATFORM_PRIMARY_ENV | typeof PLATFORM_FALLBACK_ENV | typeof CODING_PRIMARY_ENV | typeof CODING_CN_PRIMARY_ENV | "stored" | "runtime" | "models_json_command" | "models_json_key" | "none";
/** Resolve platform credential source by name only; never returns secret values. */
export declare function resolvePlatformCredentialSource(modelRegistry?: ModelRegistry): CredentialSourceName;
/** Resolve coding-plan credential source by name only; never returns secret values. */
export declare function resolveCodingCredentialSource(provider: "zai" | "zai-coding-cn", modelRegistry?: ModelRegistry): CredentialSourceName;
export declare function resolveCredentialSourceForProvider(provider: string, modelRegistry?: ModelRegistry): CredentialSourceName;
/**
 * Shell-backed apiKey for registerProvider fallback.
 * Priority: ZAI_PLATFORM_API_KEY > ZAI_API_KEY (never OPENAI_API_KEY).
 */
export declare function buildPlatformApiKeyCommand(): string;
//# sourceMappingURL=credentials.d.ts.map