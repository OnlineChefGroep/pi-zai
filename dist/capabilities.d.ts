import type { SessionAffinityMode } from "./config.ts";
import type { ZaiModel } from "./zai-model.ts";
export type ProviderOwnership = "pi-native" | "platform" | "other";
export type DynamicToolMode = "deferred" | "full-list-fallback";
export type SessionAffinitySource = "none" | "pi" | "pi-zai";
export interface ZaiCapabilities {
    providerOwnership: ProviderOwnership;
    apiFamily: string;
    usesZaiThinkingFormat: boolean;
    streamsToolCalls: boolean;
    dynamicToolMode: DynamicToolMode;
    sessionAffinitySource: SessionAffinitySource;
    sessionAffinityFormat?: string;
    toolChoiceSupportedByApi: boolean;
}
/**
 * Normalize model/API/compat metadata for hooks and diagnostics.
 * Unknown fields fail closed toward preserving Pi-native behavior.
 */
export declare function resolveZaiCapabilities(model: ZaiModel | undefined, sessionAffinity?: SessionAffinityMode): ZaiCapabilities;
export declare function isManagedZaiCapabilities(capabilities: ZaiCapabilities): boolean;
export declare function usesManagedZaiProvider(model: ZaiModel | undefined): boolean;
//# sourceMappingURL=capabilities.d.ts.map