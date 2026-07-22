import { describe, expect, it } from "vitest";
import { computeUsageCostBreakdown } from "./usage-cost.ts";

describe("computeUsageCostBreakdown", () => {
	it("separates per-token price from total cost contribution", () => {
		const result = computeUsageCostBreakdown(
			{
				input: 988_092,
				cacheRead: 38_264_384,
				cacheWrite: 0,
				output: 123_341,
			},
			{ input: 1.4, cacheRead: 0.26, cacheWrite: 0, output: 4.4 },
		);

		expect(result.uncachedInput.cost).toBeCloseTo(1.3833288, 7);
		expect(result.cachedInput.cost).toBeCloseTo(9.94873984, 7);
		expect(result.output.cost).toBeCloseTo(0.5427004, 7);
		expect(result.total).toBeCloseTo(11.87476904, 7);
		expect(result.noCacheEquivalent).toBeCloseTo(55.4961668, 7);
		expect(result.cacheSavingsEquivalent).toBeCloseTo(43.62139776, 7);
		expect(result.cachedInput.share).toBeCloseTo(0.8378049, 6);
		expect(result.output.share).toBeCloseTo(0.045702, 6);
	});

	it("returns zero shares for an empty usage sample", () => {
		const result = computeUsageCostBreakdown(
			{ input: 0, cacheRead: 0, cacheWrite: 0, output: 0 },
			{ input: 1.4, cacheRead: 0.26, cacheWrite: 0, output: 4.4 },
		);

		expect(result.total).toBe(0);
		expect(result.output.share).toBe(0);
	});
});
