import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
export { loadZaiConfig, type ZaiConfig } from "./config.ts";
export { buildPlatformApiKeyCommand, type CredentialSourceName, resolveCodingCredentialSource, resolveCredentialSourceForProvider, resolvePlatformCredentialSource, } from "./credentials.ts";
export { buildPlatformModelCatalog, GLM52_THINKING_LEVEL_MAP, PLATFORM_BASE_URL, } from "./model-catalog.ts";
export { applyPreserveThinkingOverrides, clearPreserveThinkingOverrides, registerZaiPlatformProvider, syncProviderRegistration, } from "./platform-provider.ts";
export { createZaiSessionState, dispatchZaiHook, getCacheMetricsStore, getZaiHookHandlers, inferEndpoint, isZaiProvider, resetCacheMetrics, sessionState, setZaiHookHandlers, type ZaiEndpointKind, type ZaiHookHandlers, type ZaiSessionState, } from "./state.ts";
export default function piZaiExtension(pi: ExtensionAPI): void;
//# sourceMappingURL=index.d.ts.map