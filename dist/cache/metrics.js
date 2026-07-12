import { calculateCost } from "@earendil-works/pi-ai/compat";
import { endpointsShareCache, isCodingPlanProvider, isPlatformProvider } from "./context-policy.js";
export function endpointLabel(provider, baseUrl) {
    if (isPlatformProvider(provider))
        return "platform";
    if (isCodingPlanProvider(provider) || baseUrl.includes("/coding/"))
        return "coding";
    return baseUrl;
}
export function buildCacheSegmentKey(input) {
    return {
        provider: input.provider,
        endpoint: endpointLabel(input.provider, input.baseUrl),
        model: input.model,
        systemFingerprint: input.systemFingerprint,
        toolsetFingerprint: input.toolsetFingerprint,
    };
}
export function detectSegmentChange(previous, next) {
    if (!previous) {
        return { changed: true, reasons: ["session"] };
    }
    const reasons = [];
    if (previous.provider !== next.provider)
        reasons.push("provider");
    if (previous.endpoint !== next.endpoint)
        reasons.push("endpoint");
    if (previous.model !== next.model)
        reasons.push("model");
    if (previous.systemFingerprint !== next.systemFingerprint)
        reasons.push("system-fingerprint");
    if (previous.toolsetFingerprint !== next.toolsetFingerprint)
        reasons.push("toolset-fingerprint");
    if (reasons.includes("endpoint") && !endpointsShareCache(previous.endpoint, next.endpoint)) {
        // Cross-model / cross-endpoint: never assume cache transfer.
        if (!reasons.includes("model")) {
            reasons.push("cross-endpoint-no-transfer");
        }
    }
    return { changed: reasons.length > 0, reasons };
}
export function formatSegmentChangeReason(change) {
    if (!change.changed)
        return "unchanged";
    return change.reasons.join(", ");
}
export function computeCacheRatios(usage) {
    const totalPrompt = usage.input + usage.cacheRead + usage.cacheWrite;
    if (totalPrompt <= 0) {
        return { hitRatio: 0, missRatio: 0 };
    }
    return {
        hitRatio: usage.cacheRead / totalPrompt,
        missRatio: usage.input / totalPrompt,
    };
}
export function estimateUsageCost(model, usage) {
    const copy = {
        ...usage,
        cost: { ...usage.cost },
    };
    calculateCost(model, copy);
    return copy.cost.total;
}
export function estimateCacheSavings(model, usage) {
    if (usage.cacheRead <= 0)
        return 0;
    const uncached = {
        ...usage,
        input: usage.input + usage.cacheRead,
        cacheRead: 0,
        cacheWrite: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    };
    const cached = { ...usage, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
    calculateCost(model, uncached);
    calculateCost(model, cached);
    return Math.max(0, uncached.cost.total - cached.cost.total);
}
export function createUsageSnapshot(model, usage) {
    const ratios = computeCacheRatios(usage);
    return {
        input: usage.input,
        cacheRead: usage.cacheRead,
        cacheWrite: usage.cacheWrite,
        output: usage.output,
        reasoning: usage.reasoning ?? 0,
        totalTokens: usage.totalTokens,
        cost: estimateUsageCost(model, usage),
        hitRatio: ratios.hitRatio,
        missRatio: ratios.missRatio,
        estimatedSavings: estimateCacheSavings(model, usage),
    };
}
export class CacheMetricsStore {
    stats;
    reset(segment, reason) {
        this.stats = {
            segment,
            last: undefined,
            rolling: {
                input: 0,
                cacheRead: 0,
                cacheWrite: 0,
                output: 0,
                requests: 0,
                hitRatio: 0,
                estimatedCost: 0,
                estimatedSavings: 0,
            },
            lastPrefixChangeReason: reason,
            segmentStartedAt: Date.now(),
        };
        return this.stats;
    }
    get() {
        return this.stats;
    }
    clear() {
        this.stats = undefined;
    }
    record(model, usage) {
        if (!this.stats)
            return undefined;
        const snapshot = createUsageSnapshot(model, usage);
        this.stats.last = snapshot;
        const rolling = this.stats.rolling;
        rolling.input += usage.input;
        rolling.cacheRead += usage.cacheRead;
        rolling.cacheWrite += usage.cacheWrite;
        rolling.output += usage.output;
        rolling.requests += 1;
        rolling.estimatedCost += snapshot.cost;
        rolling.estimatedSavings += snapshot.estimatedSavings;
        const ratios = computeCacheRatios({
            input: rolling.input,
            cacheRead: rolling.cacheRead,
            cacheWrite: rolling.cacheWrite,
        });
        rolling.hitRatio = ratios.hitRatio;
        return this.stats;
    }
    markCompaction() {
        if (!this.stats)
            return;
        this.stats.lastCompactionAt = Date.now();
    }
    updateSegment(segment, reason) {
        const change = detectSegmentChange(this.stats?.segment, segment);
        if (!this.stats || change.changed) {
            return this.reset(segment, reason);
        }
        return this.stats;
    }
}
//# sourceMappingURL=metrics.js.map