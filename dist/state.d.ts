import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { Model } from "@earendil-works/pi-ai";
import type { ExtensionContext, SessionStartEvent, TurnEndEvent } from "@earendil-works/pi-coding-agent";
import { CacheMetricsStore } from "./cache/metrics.ts";
export type ZaiEndpointKind = "coding" | "platform" | "coding-cn" | "unknown";
export interface ZaiSessionState {
    preserveThinking: boolean;
    endpoint: ZaiEndpointKind;
    provider: string | undefined;
    modelId: string | undefined;
    thinkingLevel: ThinkingLevel | undefined;
    credentialSource: string | undefined;
    promptStability: {
        stableLineCount: number;
        volatileLineCount: number;
        hasDynamicMarker: boolean;
        systemFingerprint: string | undefined;
    } | undefined;
}
export interface ModelSelectEvent {
    type: "model_select";
    model: Model<any>;
    previousModel: Model<any> | undefined;
    source: "set" | "cycle" | "restore";
}
export interface ZaiHookHandlers {
    onSessionStart?: (event: SessionStartEvent, ctx: ExtensionContext) => void | Promise<void>;
    onModelSelect?: (event: ModelSelectEvent, ctx: ExtensionContext) => void | Promise<void>;
    onTurnEnd?: (event: TurnEndEvent, ctx: ExtensionContext) => void | Promise<void>;
}
export declare function isZaiProvider(provider: string | undefined): boolean;
export declare function inferEndpoint(provider: string | undefined, baseUrl?: string): ZaiEndpointKind;
export declare function createZaiSessionState(preserveThinking?: boolean): ZaiSessionState;
export declare const sessionState: ZaiSessionState;
export declare function getCacheMetricsStore(): CacheMetricsStore;
export declare function resetCacheMetrics(): void;
export declare function setZaiHookHandlers(handlers: ZaiHookHandlers): void;
export declare function getZaiHookHandlers(): ZaiHookHandlers;
export declare function dispatchZaiHook(name: keyof ZaiHookHandlers, event: SessionStartEvent | ModelSelectEvent | TurnEndEvent, ctx: ExtensionContext): Promise<void>;
//# sourceMappingURL=state.d.ts.map