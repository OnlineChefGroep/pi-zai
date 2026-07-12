import type { SessionCacheStats } from "./metrics.ts";
export type CacheRecommendation = {
    priority: "high" | "medium" | "low";
    message: string;
};
export declare function buildCacheRecommendations(stats: SessionCacheStats | undefined): CacheRecommendation[];
export declare function formatCacheRecommendations(stats: SessionCacheStats | undefined): string[];
//# sourceMappingURL=recommendations.d.ts.map