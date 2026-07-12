import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { computeCacheRatios } from "../cache/metrics.ts";
import { getMetricsStorage, sessionState } from "../state.ts";
import { getCacheMetricsStore } from "./cache-state.ts";
import {
	formatDollarCost,
	formatPercent,
	formatTokens,
	formatUsageLine,
	getLastAssistantUsage,
	getSessionUsageTotals,
	isEstimatedCost,
	isSubscriptionManaged,
	requireZaiModel,
} from "./helpers.ts";

export function registerZaiUsageCommand(pi: ExtensionAPI): void {
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
			const localHistory = getMetricsStorage().getUsageSummary(
				sessionState.projectId ? { projectId: sessionState.projectId } : undefined,
			);

			const costInterpretation = isSubscriptionManaged(model)
				? "Dollar cost: subscription-managed (Coding Plan)"
				: isEstimatedCost(model)
					? `Estimated dollar cost: ${formatDollarCost(sessionTotals.cost)} (Platform API pricing metadata)`
					: "Dollar cost: unavailable";

			const localCost = localHistory.estimatedApiCostMicrousd / 1_000_000;
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
				"Local project history",
				`  Recorded attempts: ${localHistory.attempts}`,
				`  Uncached input: ${formatTokens(localHistory.inputTokens)}`,
				`  Cached input: ${formatTokens(localHistory.cacheReadTokens)}`,
				`  Output: ${formatTokens(localHistory.outputTokens)}`,
				`  Cache hit ratio: ${formatPercent(localHistory.cacheHitRatio)}`,
				`  API-equivalent cost: ${formatDollarCost(localCost)}`,
				"",
				"Last request",
				lastUsage ? `  ${formatUsageLine(lastUsage)}` : "  none",
			];

			ctx.ui.notify(lines.join("\n"), "info");
		},
	});
}
