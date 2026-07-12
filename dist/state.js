import { CacheMetricsStore } from "./cache/metrics.js";
const ZAI_PROVIDERS = new Set(["zai", "zai-coding-cn", "zai-platform"]);
export function isZaiProvider(provider) {
    return provider !== undefined && ZAI_PROVIDERS.has(provider);
}
export function inferEndpoint(provider, baseUrl) {
    if (provider === "zai-platform")
        return "platform";
    if (provider === "zai-coding-cn")
        return "coding-cn";
    if (provider === "zai" || baseUrl?.includes("/coding/"))
        return "coding";
    return "unknown";
}
export function createZaiSessionState(preserveThinking = false) {
    return {
        preserveThinking,
        endpoint: "unknown",
        provider: undefined,
        modelId: undefined,
        thinkingLevel: undefined,
        credentialSource: undefined,
        promptStability: undefined,
    };
}
export const sessionState = createZaiSessionState();
let hookHandlers = {};
let cacheMetricsStore = new CacheMetricsStore();
export function getCacheMetricsStore() {
    return cacheMetricsStore;
}
export function resetCacheMetrics() {
    cacheMetricsStore = new CacheMetricsStore();
}
export function setZaiHookHandlers(handlers) {
    hookHandlers = handlers;
}
export function getZaiHookHandlers() {
    return hookHandlers;
}
export async function dispatchZaiHook(name, event, ctx) {
    const handler = hookHandlers[name];
    if (!handler)
        return;
    await handler(event, ctx);
}
//# sourceMappingURL=state.js.map