export const PLATFORM_PRIMARY_ENV = "ZAI_PLATFORM_API_KEY";
export const PLATFORM_FALLBACK_ENV = "ZAI_API_KEY";
export const CODING_PRIMARY_ENV = "ZAI_API_KEY";
export const CODING_CN_PRIMARY_ENV = "ZAI_CODING_CN_API_KEY";
function envVarConfigured(name) {
    const value = process.env[name];
    return typeof value === "string" && value.trim().length > 0;
}
function authStatusSourceName(provider, modelRegistry) {
    const status = modelRegistry?.getProviderAuthStatus(provider);
    if (!status?.configured)
        return undefined;
    if (status.source === "environment" && status.label) {
        return status.label;
    }
    if (status.source === "stored")
        return "stored";
    if (status.source === "runtime")
        return "runtime";
    if (status.source === "models_json_command")
        return "models_json_command";
    if (status.source === "models_json_key")
        return "models_json_key";
    return undefined;
}
/** Resolve platform credential source by name only; never returns secret values. */
export function resolvePlatformCredentialSource(modelRegistry) {
    if (envVarConfigured(PLATFORM_PRIMARY_ENV))
        return PLATFORM_PRIMARY_ENV;
    if (envVarConfigured(PLATFORM_FALLBACK_ENV))
        return PLATFORM_FALLBACK_ENV;
    return authStatusSourceName("zai-platform", modelRegistry) ?? "none";
}
/** Resolve coding-plan credential source by name only; never returns secret values. */
export function resolveCodingCredentialSource(provider, modelRegistry) {
    if (provider === "zai-coding-cn") {
        if (envVarConfigured(CODING_CN_PRIMARY_ENV))
            return CODING_CN_PRIMARY_ENV;
        return authStatusSourceName(provider, modelRegistry) ?? "none";
    }
    if (envVarConfigured(CODING_PRIMARY_ENV))
        return CODING_PRIMARY_ENV;
    return authStatusSourceName(provider, modelRegistry) ?? "none";
}
export function resolveCredentialSourceForProvider(provider, modelRegistry) {
    if (provider === "zai-platform")
        return resolvePlatformCredentialSource(modelRegistry);
    if (provider === "zai-coding-cn")
        return resolveCodingCredentialSource("zai-coding-cn", modelRegistry);
    if (provider === "zai")
        return resolveCodingCredentialSource("zai", modelRegistry);
    return "none";
}
/**
 * Shell-backed apiKey for registerProvider fallback.
 * Priority: ZAI_PLATFORM_API_KEY > ZAI_API_KEY (never OPENAI_API_KEY).
 */
export function buildPlatformApiKeyCommand() {
    return `!if [ -n "$${PLATFORM_PRIMARY_ENV}" ]; then printf '%s' "$${PLATFORM_PRIMARY_ENV}"; elif [ -n "$${PLATFORM_FALLBACK_ENV}" ]; then printf '%s' "$${PLATFORM_FALLBACK_ENV}"; fi`;
}
//# sourceMappingURL=credentials.js.map