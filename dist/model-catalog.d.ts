import type { ProviderModelConfig } from "@earendil-works/pi-coding-agent";
/** Verified against https://docs.z.ai/guides/overview/pricing (USD per 1M tokens). */
export declare const PLATFORM_BASE_URL = "https://api.z.ai/api/paas/v4";
/** Keep this aligned with Pi's native GLM-5.2 catalog. */
export declare const GLM52_THINKING_LEVEL_MAP: {
    readonly minimal: null;
    readonly low: "high";
    readonly medium: "high";
    readonly high: "high";
    readonly max: "max";
};
/**
 * Kept for source compatibility. Preserved thinking is controlled by Pi's
 * native payload and the before_provider_request override, not model metadata.
 */
export type PlatformModelCatalogOptions = {
    preserveThinking?: boolean;
};
export declare function buildPlatformModelCatalog(_options?: PlatformModelCatalogOptions): ProviderModelConfig[];
//# sourceMappingURL=model-catalog.d.ts.map