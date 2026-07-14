import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
export { loadZaiConfig, type ZaiConfig } from "./config.ts";
export { formatPiCredentialSource } from "./credentials.ts";
export { buildPlatformModelCatalog, GLM52_THINKING_LEVEL_MAP, PLATFORM_BASE_URL, } from "./model-catalog.ts";
export { isNativeZaiModel } from "./native-zai.ts";
export { normalizeZaiThinkingPayload } from "./payload-normalizer.ts";
export { createZaiSessionState, dispatchZaiHook, getCacheMetricsStore, getMetricsStorage, getZaiHookHandlers, inferEndpoint, isZaiProvider, resetCacheMetrics, sessionState, setZaiHookHandlers, type ZaiEndpointKind, type ZaiHookHandlers, type ZaiSessionState, } from "./state.ts";
export { EXTENSION_VERSION } from "./version.generated.ts";
export default function piZaiExtension(pi: ExtensionAPI): void;
//# sourceMappingURL=index.d.ts.map