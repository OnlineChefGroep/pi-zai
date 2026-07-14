import { randomUUID } from "node:crypto";
import { AttemptTracker } from "./attempt-tracker.js";
import { CacheMetricsStore } from "./cache/metrics.js";
import { QueryCorrelation } from "./correlation.js";
import { TpsTracker } from "./telemetry/tps.js";
import { ToolExecutionTracker } from "./tool-tracker.js";
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
export function newSessionAffinityId() {
    return `pi-${randomUUID()}`;
}
export function createZaiSessionState(preserveThinking) {
    return {
        preserveThinking,
        endpoint: "unknown",
        provider: undefined,
        modelId: undefined,
        thinkingLevel: undefined,
        credentialSource: undefined,
        sessionHash: undefined,
        projectId: undefined,
        sessionAffinityId: newSessionAffinityId(),
        activeBenchmarkRunId: undefined,
        promptStability: undefined,
        lastToolsetSnapshot: undefined,
        lastToolsetTransition: undefined,
        toolsetGeneration: 0,
        adaptiveTools: undefined,
    };
}
export const sessionState = createZaiSessionState();
let hookHandlers = {};
let cacheMetricsStore = new CacheMetricsStore();
let tpsTracker = new TpsTracker();
let metricsStorage;
let queryCorrelation = new QueryCorrelation();
let attemptTracker = new AttemptTracker();
let toolExecutionTracker = new ToolExecutionTracker();
let lastMetricsCleanupDay;
export function getCacheMetricsStore() {
    return cacheMetricsStore;
}
export function getTpsTracker() {
    return tpsTracker;
}
export function getMetricsStorage() {
    return metricsStorage;
}
export function setMetricsStorage(storage) {
    metricsStorage?.close();
    metricsStorage = storage;
}
export function getQueryCorrelation() {
    return queryCorrelation;
}
export function getAttemptTracker() {
    return attemptTracker;
}
export function getToolExecutionTracker() {
    return toolExecutionTracker;
}
export function resetCorrelationState() {
    queryCorrelation = new QueryCorrelation();
    attemptTracker = new AttemptTracker();
}
export function resetToolMetrics() {
    toolExecutionTracker = new ToolExecutionTracker();
}
export function resetCacheMetrics() {
    cacheMetricsStore = new CacheMetricsStore();
}
export function resetTpsMetrics() {
    tpsTracker = new TpsTracker();
}
export function shouldRunDailyMetricsCleanup(now = Date.now()) {
    const day = new Date(now).toISOString().slice(0, 10);
    if (lastMetricsCleanupDay === day)
        return false;
    lastMetricsCleanupDay = day;
    return true;
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