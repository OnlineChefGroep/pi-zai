import { computeCacheRatios } from "./metrics.js";
import { formatCacheRecommendations } from "./recommendations.js";
function formatPercent(ratio) {
    return `${(ratio * 100).toFixed(1)}%`;
}
function formatTokens(count) {
    return count.toLocaleString("en-US");
}
function formatCost(amount, priced) {
    if (!priced)
        return "subscription-managed";
    if (amount <= 0)
        return "$0.00";
    return `$${amount.toFixed(4)}`;
}
function formatTimestamp(epochMs) {
    if (epochMs === undefined)
        return "none";
    return new Date(epochMs).toISOString();
}
function segmentLines(stats) {
    const { segment, last, rolling } = stats;
    const promptTokens = rolling.input + rolling.cacheRead + rolling.cacheWrite;
    const segmentRatios = computeCacheRatios(rolling);
    return [
        "Current segment",
        `  Provider: ${segment.provider}`,
        `  Endpoint: ${segment.endpoint}`,
        `  Model: ${segment.model}`,
        `  Stable-prefix fingerprint: ${segment.systemFingerprint}`,
        `  Toolset fingerprint: ${segment.toolsetFingerprint}`,
        "",
        "Prompt tokens (current segment)",
        `  Uncached input: ${formatTokens(rolling.input)}`,
        `  Cached input: ${formatTokens(rolling.cacheRead)}`,
        `  Cache write: ${formatTokens(rolling.cacheWrite)}`,
        `  Total prompt: ${formatTokens(promptTokens)}`,
        `  Output: ${formatTokens(rolling.output)}`,
        "",
        "Cache ratios",
        `  Last successful request hit ratio: ${last ? formatPercent(last.hitRatio) : "n/a"}`,
        `  Segment hit ratio: ${formatPercent(segmentRatios.hitRatio)}`,
        `  Segment miss ratio: ${formatPercent(segmentRatios.missRatio)}`,
        "",
        "Cost",
        `  Estimated segment cost: ${formatCost(rolling.estimatedCost, segment.endpoint === "platform")}`,
        `  Estimated segment cache savings: ${formatCost(rolling.estimatedSavings, segment.endpoint === "platform")}`,
        "",
        "Boundaries",
        `  Segment start reason: ${stats.lastPrefixChangeReason ?? "none"}`,
        `  Last compaction: ${formatTimestamp(stats.lastCompactionAt)}`,
        `  Segment started: ${formatTimestamp(stats.segmentStartedAt)}`,
        `  Successful provider requests in segment: ${rolling.requests}`,
        "",
        "Recommendations",
        ...formatCacheRecommendations(stats),
    ];
}
export function formatCacheDiagnostics(input, action = "status") {
    if (!input.isZaiSession) {
        return "Cache diagnostics are only available for active Z.AI sessions.";
    }
    if (action === "reset-stats") {
        return "Cache metrics reset. A new segment will begin on the next Z.AI request.";
    }
    if (action === "explain") {
        return [
            "Z.AI implicit cache",
            "",
            "Z.AI reuses repeated prompt prefixes automatically. There is no manual cache breakpoint.",
            "Stable system prompts, tool definitions, and append-only history improve hit ratio.",
            "",
            "Pi native usage mapping",
            "  uncached input = usage.input",
            "  cached input = usage.cacheRead",
            "  cache writes = usage.cacheWrite",
            "  total prompt = input + cacheRead + cacheWrite",
            "  miss ratio = (input + cacheWrite) / total prompt",
            "",
            "Segment boundaries reset these diagnostics when any of these change:",
            "  provider, endpoint, model, system fingerprint, toolset fingerprint, session",
            "",
            "Dynamic tools (Pi 0.80.7+): Z.AI uses full-list fallback, so activating tools",
            "during a turn starts a new cache segment on the next provider request.",
            "",
            "The segment view is intentionally narrower than Pi's full Session Info.",
            "It does not combine earlier models, providers, extension reloads, or segments.",
            "",
            "Cross-model rule: cache is not assumed to transfer between coding and platform endpoints,",
            "different models, different system prompts, or different toolsets.",
        ].join("\n");
    }
    if (!input.stats || input.stats.rolling.requests === 0) {
        return [
            "Z.AI cache diagnostics",
            "",
            "No successful provider cache samples recorded for the current segment.",
            "Send a Z.AI request to begin tracking.",
        ].join("\n");
    }
    return ["Z.AI cache diagnostics", "", ...segmentLines(input.stats)].join("\n");
}
export function formatCacheStatus(input) {
    return formatCacheDiagnostics(input, "status");
}
export function formatCacheExplain(input) {
    return formatCacheDiagnostics(input, "explain");
}
export function formatCacheResetMessage() {
    return formatCacheDiagnostics({ stats: undefined, isZaiSession: true }, "reset-stats");
}
//# sourceMappingURL=diagnostics.js.map