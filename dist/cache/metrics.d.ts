import type { Usage } from "@earendil-works/pi-ai";
import { type Model } from "@earendil-works/pi-ai/compat";
export type CacheSegmentKey = {
    provider: string;
    endpoint: string;
    model: string;
    systemFingerprint: string;
    toolsetFingerprint: string;
};
export type SegmentChange = {
    changed: boolean;
    reasons: string[];
};
export type CacheUsageSnapshot = {
    input: number;
    cacheRead: number;
    cacheWrite: number;
    output: number;
    reasoning: number;
    totalTokens: number;
    cost: number;
    hitRatio: number;
    missRatio: number;
    estimatedSavings: number;
};
export type SessionCacheStats = {
    segment: CacheSegmentKey;
    last: CacheUsageSnapshot | undefined;
    rolling: {
        input: number;
        cacheRead: number;
        cacheWrite: number;
        output: number;
        requests: number;
        hitRatio: number;
        estimatedCost: number;
        estimatedSavings: number;
    };
    lastPrefixChangeReason?: string;
    lastCompactionAt?: number;
    segmentStartedAt: number;
};
export declare function endpointLabel(provider: string, baseUrl: string): string;
export declare function buildCacheSegmentKey(input: {
    provider: string;
    baseUrl: string;
    model: string;
    systemFingerprint: string;
    toolsetFingerprint: string;
}): CacheSegmentKey;
export declare function detectSegmentChange(previous: CacheSegmentKey | undefined, next: CacheSegmentKey): SegmentChange;
export declare function formatSegmentChangeReason(change: SegmentChange): string;
export declare function computeCacheRatios(usage: Pick<Usage, "input" | "cacheRead" | "cacheWrite">): {
    hitRatio: number;
    missRatio: number;
};
export declare function estimateUsageCost(model: Model<any>, usage: Usage): number;
export declare function estimateCacheSavings(model: Model<any>, usage: Usage): number;
export declare function createUsageSnapshot(model: Model<any>, usage: Usage): CacheUsageSnapshot;
export declare class CacheMetricsStore {
    private stats;
    reset(segment: CacheSegmentKey, reason?: string): SessionCacheStats;
    get(): SessionCacheStats | undefined;
    clear(): void;
    record(model: Model<any>, usage: Usage): SessionCacheStats | undefined;
    markCompaction(): void;
    updateSegment(segment: CacheSegmentKey, reason: string): SessionCacheStats;
}
//# sourceMappingURL=metrics.d.ts.map