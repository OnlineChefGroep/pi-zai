import { computeCacheRatios } from "../cache/metrics.js";
import { getCacheMetricsStore } from "./cache-state.js";
import { formatDollarCost, formatPercent, formatTokens, formatUsageLine, getLastAssistantUsage, getSessionUsageTotals, isEstimatedCost, isSubscriptionManaged, requireZaiModel, } from "./helpers.js";
export function registerZaiUsageCommand(pi) {
    pi.registerCommand("zai-usage", {
        description: "Show native Pi usage with Z.AI cache and cost interpretation",
        handler: async (_args, ctx) => {
            const check = requireZaiModel(ctx);
            if ("error" in check) {
                ctx.ui.notify(check.error, "warning");
                return;
            }
            const model = check.model;
            const lastUsage = getLastAssistantUsage(ctx);
            const sessionTotals = getSessionUsageTotals(ctx);
            const cacheStats = getCacheMetricsStore().get();
            const sessionPrompt = sessionTotals.input + sessionTotals.cacheRead + sessionTotals.cacheWrite;
            const sessionRatios = computeCacheRatios({
                input: sessionTotals.input,
                cacheRead: sessionTotals.cacheRead,
                cacheWrite: sessionTotals.cacheWrite,
            });
            const costInterpretation = isSubscriptionManaged(model)
                ? "Dollar cost: subscription-managed (Coding Plan)"
                : isEstimatedCost(model)
                    ? `Estimated dollar cost: ${formatDollarCost(sessionTotals.cost)} (Platform API pricing metadata)`
                    : "Dollar cost: unavailable";
            const lines = [
                "Z.AI usage",
                "",
                "Pi native token accounting",
                `  Requests: ${sessionTotals.requests}`,
                `  Uncached input: ${formatTokens(sessionTotals.input)}`,
                `  Cached input (cacheRead): ${formatTokens(sessionTotals.cacheRead)}`,
                `  Cache write: ${formatTokens(sessionTotals.cacheWrite)}`,
                `  Output: ${formatTokens(sessionTotals.output)}`,
                `  Total prompt: ${formatTokens(sessionPrompt)}`,
                "",
                "Z.AI interpretation",
                "  input = uncached prompt tokens",
                "  cacheRead = cached prompt tokens",
                "  total prompt = input + cacheRead + cacheWrite",
                `  Session hit ratio: ${formatPercent(sessionRatios.hitRatio)}`,
                `  Extension rolling hit ratio: ${cacheStats ? formatPercent(cacheStats.rolling.hitRatio) : "n/a"}`,
                `  ${costInterpretation}`,
                "",
                "Last request",
                lastUsage ? `  ${formatUsageLine(lastUsage)}` : "  none",
            ];
            ctx.ui.notify(lines.join("\n"), "info");
        },
    });
}
//# sourceMappingURL=usage.js.map