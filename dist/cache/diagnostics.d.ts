import type { SessionCacheStats } from "./metrics.ts";
export type CacheDiagnosticAction = "status" | "reset-stats" | "explain";
export type CacheDiagnosticsInput = {
    stats: SessionCacheStats | undefined;
    isZaiSession: boolean;
};
export declare function formatCacheDiagnostics(input: CacheDiagnosticsInput, action?: CacheDiagnosticAction): string;
export declare function formatCacheStatus(input: CacheDiagnosticsInput): string;
export declare function formatCacheExplain(input: CacheDiagnosticsInput): string;
export declare function formatCacheResetMessage(): string;
//# sourceMappingURL=diagnostics.d.ts.map