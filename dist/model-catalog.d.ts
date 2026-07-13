import type { ProviderModelConfig } from "@earendil-works/pi-coding-agent";
/** Verified against https://docs.z.ai/guides/overview/pricing (USD per 1M tokens). */
export declare const PLATFORM_BASE_URL = "https://api.z.ai/api/paas/v4";
export declare const GLM52_THINKING_LEVEL_MAP: {
    readonly minimal: null;
    readonly low: null;
    readonly medium: null;
    readonly high: "high";
    readonly xhigh: "max";
    readonly max: "max";
};
export type PlatformModelCatalogOptions = {
    preserveThinking?: boolean;
};
export declare function buildPlatformModelCatalog(options?: PlatformModelCatalogOptions): ProviderModelConfig[];
//# sourceMappingURL=model-catalog.d.ts.map