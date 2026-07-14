import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { ExtensionContext, SessionStartEvent, TurnEndEvent } from "@earendil-works/pi-coding-agent";
import { AttemptTracker } from "./attempt-tracker.ts";
import { CacheMetricsStore } from "./cache/metrics.ts";
import type { ToolsetSnapshot, ToolsetTransition } from "./cache/toolset-snapshot.ts";
import { QueryCorrelation } from "./correlation.ts";
import type { MetricsStorage } from "./storage/types.ts";
import { TpsTracker } from "./telemetry/tps.ts";
import { ToolExecutionTracker } from "./tool-tracker.ts";
import type { ZaiModel } from "./zai-model.ts";
export type ZaiEndpointKind = "coding" | "platform" | "coding-cn" | "unknown";
export interface ZaiSessionState {
    /** Undefined means Pi's native Z.AI payload is left unchanged. */
    preserveThinking: boolean | undefined;
    endpoint: ZaiEndpointKind;
    provider: string | undefined;
    modelId: string | undefined;
    thinkingLevel: ThinkingLevel | undefined;
    credentialSource: string | undefined;
    sessionHash: string | undefined;
    projectId: string | undefined;
    /**
     * Stable per-session id sent as `X-Session-Id` for Z.AI cache affinity.
     * Pinning consecutive requests to the same backend node keeps the implicit
     * prefix cache warm, raising cache hit rates.
     */
    sessionAffinityId: string;
    activeBenchmarkRunId: string | undefined;
    promptStability: {
        stableLineCount: number;
        volatileLineCount: number;
        hasDynamicMarker: boolean;
        systemFingerprint: string | undefined;
    } | undefined;
    lastToolsetSnapshot: ToolsetSnapshot | undefined;
    lastToolsetTransition: (ToolsetTransition & {
        apiFamily?: string;
        dynamicToolMode?: string;
    }) | undefined;
    toolsetGeneration: number;
    adaptiveTools: {
        mode: string;
        loaderInvocations: number;
        lastAddedCount: number;
    } | undefined;
}
export interface ModelSelectEvent {
    type: "model_select";
    model: ZaiModel;
    previousModel: ZaiModel | undefined;
    source: "set" | "cycle" | "restore";
}
export interface ZaiHookHandlers {
    onSessionStart?: (event: SessionStartEvent, ctx: ExtensionContext) => void | Promise<void>;
    onModelSelect?: (event: ModelSelectEvent, ctx: ExtensionContext) => void | Promise<void>;
    onTurnEnd?: (event: TurnEndEvent, ctx: ExtensionContext) => void | Promise<void>;
}
export declare function isZaiProvider(provider: string | undefined): boolean;
export declare function inferEndpoint(provider: string | undefined, baseUrl?: string): ZaiEndpointKind;
export declare function newSessionAffinityId(): string;
export declare function createZaiSessionState(preserveThinking?: boolean): ZaiSessionState;
export declare const sessionState: ZaiSessionState;
export declare function getCacheMetricsStore(): CacheMetricsStore;
export declare function getTpsTracker(): TpsTracker;
export declare function getMetricsStorage(): MetricsStorage | undefined;
export declare function setMetricsStorage(storage: MetricsStorage | undefined): void;
export declare function getQueryCorrelation(): QueryCorrelation;
export declare function getAttemptTracker(): AttemptTracker;
export declare function getToolExecutionTracker(): ToolExecutionTracker;
export declare function resetCorrelationState(): void;
export declare function resetToolMetrics(): void;
export declare function resetCacheMetrics(): void;
export declare function resetTpsMetrics(): void;
export declare function shouldRunDailyMetricsCleanup(now?: number): boolean;
export declare function setZaiHookHandlers(handlers: ZaiHookHandlers): void;
export declare function getZaiHookHandlers(): ZaiHookHandlers;
export declare function dispatchZaiHook(name: keyof ZaiHookHandlers, event: SessionStartEvent | ModelSelectEvent | TurnEndEvent, ctx: ExtensionContext): Promise<void>;
//# sourceMappingURL=state.d.ts.map