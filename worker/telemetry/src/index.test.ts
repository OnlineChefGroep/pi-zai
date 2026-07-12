import { describe, expect, it } from "vitest";
import { MAX_BODY_BYTES, MAX_BY_PROVIDER_MODEL_ROWS, validateBody } from "./index.ts";
import { checkRateLimit, isBodyTooLarge, resetRateLimitState } from "./limits.ts";

const validBody = {
	schema: 1,
	day: "2026-07-12",
	extensionVersion: "0.3.0",
	promptMode: "observe",
	attempts: 1,
	errors: 0,
	inputTokens: 10,
	cacheReadTokens: 0,
	cacheWriteTokens: 0,
	outputTokens: 5,
	turnBucket: "0-5",
	cacheRatioBucket: "0-25",
	retryRateBucket: "0-2",
	byProviderModel: [{ provider: "zai", model: "glm-5.2", endpointKind: "coding", attempts: 1, errors: 0 }],
	errorCategories: {},
};

describe("telemetry worker limits", () => {
	it("rejects oversized Content-Length before parsing", () => {
		const request = new Request("https://example.test/pi-zai/telemetry/v1/aggregate", {
			method: "POST",
			headers: { "Content-Length": String(MAX_BODY_BYTES + 1) },
		});
		expect(isBodyTooLarge(request)).toBe(true);
	});

	it("rejects byProviderModel arrays above the configured cap", () => {
		const rows = Array.from({ length: MAX_BY_PROVIDER_MODEL_ROWS + 1 }, () => ({
			provider: "zai",
			model: "glm-5.2",
			endpointKind: "coding",
			attempts: 1,
			errors: 0,
		}));
		expect(validateBody({ ...validBody, byProviderModel: rows })).toContain("exceeds max length");
	});

	it("enforces a per-client request rate limit", () => {
		resetRateLimitState();
		const now = Date.now();
		for (let index = 0; index < 30; index += 1) {
			expect(checkRateLimit("client-a", now)).toBe(true);
		}
		expect(checkRateLimit("client-a", now)).toBe(false);
		expect(checkRateLimit("client-b", now)).toBe(true);
	});
});
