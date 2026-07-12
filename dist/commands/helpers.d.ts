import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { Model, Usage } from "@earendil-works/pi-ai";
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { ZaiConfig } from "../config.ts";
export type SessionUsageTotals = {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    cost: number;
    requests: number;
};
type ZaiOpenAICompat = {
    zaiToolStream?: boolean;
};
export declare function getZaiCompat(model: Model<any> | undefined): ZaiOpenAICompat | undefined;
export declare function formatPercent(ratio: number): string;
export declare function formatTokens(count: number): string;
export declare function formatDollarCost(amount: number): string;
export declare function getEndpointLabel(model: Model<any>): string;
export declare function describeClearThinking(config: ZaiConfig, thinkingLevel: ThinkingLevel, model: Model<any> | undefined): string;
export declare function describePreservedThinking(config: ZaiConfig): string;
export declare function describeThinkingPayload(config: ZaiConfig, thinkingLevel: ThinkingLevel, model: Model<any> | undefined): string;
export declare function getLastAssistantUsage(ctx: ExtensionCommandContext): Usage | undefined;
export declare function getSessionUsageTotals(ctx: ExtensionCommandContext): SessionUsageTotals;
export declare function formatCredentialSource(provider: string, ctx: Pick<ExtensionCommandContext, "modelRegistry">): string;
export declare function isSubscriptionManaged(model: Model<any> | undefined): boolean;
export declare function isEstimatedCost(model: Model<any> | undefined): boolean;
export declare function formatUsageLine(usage: Usage): string;
export declare function requireZaiModel(ctx: ExtensionCommandContext): {
    model: Model<any>;
} | {
    error: string;
};
export {};
//# sourceMappingURL=helpers.d.ts.map