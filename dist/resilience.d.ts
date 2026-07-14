import { type ZaiEndpointKind } from "./state.ts";
import type { ZaiModel } from "./zai-model.ts";
export type EndpointProbeResult = {
    endpoint: ZaiEndpointKind;
    baseUrl: string;
    ok: number;
    fail: number;
    latencyMs: number[];
};
export type PiRetrySettingsSnapshot = {
    enabled: boolean;
    agentMaxRetries: number;
    providerMaxRetries: number;
};
export declare function isConnectionErrorMessage(message: string | undefined): boolean;
export declare function readPiRetrySettings(): PiRetrySettingsSnapshot;
export declare function formatRetrySettingsAdvice(settings: PiRetrySettingsSnapshot): string | undefined;
export declare function formatRecommendedRetrySettingsJson(): string;
export declare function formatConnectionErrorHint(model: ZaiModel): string;
export declare function probeChatEndpoint(baseUrl: string, apiKey: string, attempts?: number): Promise<Omit<EndpointProbeResult, "endpoint">>;
export declare function formatProbeSummary(result: EndpointProbeResult): string;
//# sourceMappingURL=resilience.d.ts.map