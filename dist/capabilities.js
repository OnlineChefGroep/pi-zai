import { isManagedZaiProvider, isPiNativeZaiProvider, isZaiPlatformProvider, } from "./native-zai.js";
function readCompat(model) {
    const compat = model?.compat;
    if (!compat || typeof compat !== "object")
        return {};
    return compat;
}
function resolveOwnership(provider) {
    if (isPiNativeZaiProvider(provider))
        return "pi-native";
    if (isZaiPlatformProvider(provider))
        return "platform";
    return "other";
}
function resolveDynamicToolMode(apiFamily, compat) {
    if ((apiFamily === "openai-responses" ||
        apiFamily === "openai-codex-responses") &&
        compat.supportsToolSearch === true) {
        return "deferred";
    }
    if (apiFamily === "anthropic-messages" &&
        compat.supportsToolReferences === true) {
        return "deferred";
    }
    return "full-list-fallback";
}
function resolveAffinitySource(ownership, compat, sessionAffinity) {
    const format = typeof compat.sessionAffinityFormat === "string"
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
export function resolveZaiCapabilities(model, sessionAffinity = "off") {
    const ownership = resolveOwnership(model?.provider);
    const apiFamily = typeof model?.api === "string" && model.api.length > 0
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
        toolChoiceSupportedByApi: apiFamily === "openai-responses" ||
            apiFamily === "openai-codex-responses",
    };
}
export function isManagedZaiCapabilities(capabilities) {
    return (capabilities.providerOwnership === "pi-native" ||
        capabilities.providerOwnership === "platform");
}
export function usesManagedZaiProvider(model) {
    return isManagedZaiProvider(model?.provider);
}
//# sourceMappingURL=capabilities.js.map