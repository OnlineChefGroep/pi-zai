export type PromptStabilityMode = "off" | "observe" | "safe";
export type SessionAffinityMode = "off" | "observe" | "experimental";
export type MetricsMode = "off" | "memory" | "local";
export type TelemetryMode = "off" | "aggregate";
export interface ZaiMetricsSettings {
    mode?: MetricsMode;
    retentionDays?: number;
    rollupRetentionDays?: number;
    maxDatabaseBytes?: number;
}
export interface ZaiPromptStabilitySettings {
    mode?: PromptStabilityMode;
}
export interface ZaiTelemetrySettings {
    mode?: TelemetryMode;
    ingestUrl?: string;
}
export interface ZaiSettings {
    /**
     * Optional override for Pi's native Z.AI preserved-thinking behavior.
     * Omit to leave the upstream request payload unchanged.
     */
    preserveThinking?: boolean;
    statusTps?: boolean;
    statusTpsAvg?: boolean;
    promptStability?: ZaiPromptStabilitySettings;
    sessionAffinity?: SessionAffinityMode;
    metrics?: ZaiMetricsSettings;
    telemetry?: ZaiTelemetrySettings;
}
export interface ZaiMetricsConfig {
    mode: MetricsMode;
    retentionDays: number;
    rollupRetentionDays: number;
    maxDatabaseBytes: number;
}
export interface ZaiConfig {
    /** Undefined means: preserve Pi's native payload unchanged. */
    preserveThinking: boolean | undefined;
    statusTps: boolean;
    statusTpsAvg: boolean;
    promptStabilityMode: PromptStabilityMode;
    sessionAffinity: SessionAffinityMode;
    metrics: ZaiMetricsConfig;
    telemetryMode: TelemetryMode;
    telemetryIngestUrl?: string;
}
export declare function loadZaiConfig(cwd?: string): ZaiConfig;
//# sourceMappingURL=config.d.ts.map