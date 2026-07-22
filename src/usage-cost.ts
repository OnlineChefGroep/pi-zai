export type UsageTokenTotals = {
	input: number;
	cacheRead: number;
	cacheWrite: number;
	output: number;
};

export type UsageTokenRates = {
	input: number;
	cacheRead: number;
	cacheWrite: number;
	output: number;
};

export type UsageCostComponent = {
	tokens: number;
	ratePerMillion: number;
	cost: number;
	share: number;
};

export type UsageCostBreakdown = {
	uncachedInput: UsageCostComponent;
	cachedInput: UsageCostComponent;
	cacheWrite: UsageCostComponent;
	output: UsageCostComponent;
	total: number;
	noCacheEquivalent: number;
	cacheSavingsEquivalent: number;
};

function component(tokens: number, ratePerMillion: number): UsageCostComponent {
	return {
		tokens,
		ratePerMillion,
		cost: (tokens / 1_000_000) * ratePerMillion,
		share: 0,
	};
}

/**
 * Convert native Pi token accounting into a metered-price contribution view.
 * Rates are USD per one million tokens. This is also useful as a Platform-rate
 * equivalent for subscription-managed Coding Plan traffic; it is not a bill.
 */
export function computeUsageCostBreakdown(
	usage: UsageTokenTotals,
	rates: UsageTokenRates,
): UsageCostBreakdown {
	const uncachedInput = component(usage.input, rates.input);
	const cachedInput = component(usage.cacheRead, rates.cacheRead);
	const cacheWrite = component(usage.cacheWrite, rates.cacheWrite);
	const output = component(usage.output, rates.output);
	const components = [uncachedInput, cachedInput, cacheWrite, output];
	const total = components.reduce((sum, item) => sum + item.cost, 0);
	for (const item of components) {
		item.share = total > 0 ? item.cost / total : 0;
	}

	const promptTokens = usage.input + usage.cacheRead + usage.cacheWrite;
	const noCacheEquivalent =
		(promptTokens / 1_000_000) * rates.input + output.cost;

	return {
		uncachedInput,
		cachedInput,
		cacheWrite,
		output,
		total,
		noCacheEquivalent,
		cacheSavingsEquivalent: Math.max(0, noCacheEquivalent - total),
	};
}
