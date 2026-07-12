import { describe, expect, it } from "vitest";
import worker, {
	MAX_BODY_BYTES,
	MAX_BY_PROVIDER_MODEL_ROWS,
	validateBody,
} from "./index.ts";
import {
	checkRateLimit,
	enforceRateLimit,
	isBodyTooLarge,
	type RateLimitBinding,
	resetRateLimitState,
} from "./limits.ts";

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
	byProviderModel: [
		{
			provider: "zai",
			model: "glm-5.2",
			endpointKind: "coding",
			attempts: 1,
			errors: 0,
		},
	],
	errorCategories: {},
};

function createRateLimitBinding(limit: number): RateLimitBinding {
	const counts = new Map<string, number>();
	return {
		async limit({ key }) {
			const next = (counts.get(key) ?? 0) + 1;
			counts.set(key, next);
			return { success: next <= limit };
		},
	};
}

describe("telemetry worker limits", () => {
	it("rejects oversized Content-Length before parsing", () => {
		const request = new Request(
			"https://example.test/pi-zai/telemetry/v1/aggregate",
			{
				method: "POST",
				headers: { "Content-Length": String(MAX_BODY_BYTES + 1) },
			},
		);
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
		expect(validateBody({ ...validBody, byProviderModel: rows })).toContain(
			"exceeds max length",
		);
	});

	it("enforces a per-client request rate limit via local fallback", () => {
		resetRateLimitState();
		const now = Date.now();
		for (let index = 0; index < 30; index += 1) {
			expect(checkRateLimit("client-a", now)).toBe(true);
		}
		expect(checkRateLimit("client-a", now)).toBe(false);
		expect(checkRateLimit("client-b", now)).toBe(true);
	});

	it("uses the Cloudflare rate limit binding when configured", async () => {
		const request = new Request(
			"https://example.test/pi-zai/telemetry/v1/aggregate",
			{
				method: "POST",
				headers: { "CF-Connecting-IP": "203.0.113.10" },
			},
		);
		const env = { PI_ZAI_RATE_LIMITER: createRateLimitBinding(1) };

		expect(await enforceRateLimit(request, env)).toBe(true);
		expect(await enforceRateLimit(request, env)).toBe(false);
	});
});

describe("telemetry worker fetch handler", () => {
	it("returns 413 for oversized request bodies", async () => {
		const request = new Request(
			"https://api.chefgroep.online/pi-zai/telemetry/v1/aggregate",
			{
				method: "POST",
				headers: { "Content-Length": String(MAX_BODY_BYTES + 1) },
			},
		);
		const response = await worker.fetch(request, {});
		expect(response.status).toBe(413);
	});

	it("returns 413 for oversized bodies without Content-Length", async () => {
		const request = new Request(
			"https://api.chefgroep.online/pi-zai/telemetry/v1/aggregate",
			{
				method: "POST",
				body: "a".repeat(MAX_BODY_BYTES + 1),
			},
		);
		expect(request.headers.get("Content-Length")).toBeNull();

		const response = await worker.fetch(request, {});
		expect(response.status).toBe(413);
	});

	it("returns 413 when a multibyte body exceeds the UTF-8 byte limit", async () => {
		const request = new Request(
			"https://api.chefgroep.online/pi-zai/telemetry/v1/aggregate",
			{
				method: "POST",
				body: `"${"é".repeat(MAX_BODY_BYTES / 2)}"`,
			},
		);
		expect(request.headers.get("Content-Length")).toBeNull();

		const response = await worker.fetch(request, {});
		expect(response.status).toBe(413);
	});

	it("returns 429 when rate limited", async () => {
		resetRateLimitState();
		const env = {};
		const request = new Request(
			"https://api.chefgroep.online/pi-zai/telemetry/v1/aggregate",
			{
				method: "POST",
				headers: {
					"CF-Connecting-IP": "203.0.113.44",
					"Content-Type": "application/json",
				},
				body: JSON.stringify(validBody),
			},
		);

		for (let index = 0; index < 30; index += 1) {
			const allowed = await worker.fetch(request, env);
			expect(allowed.status).not.toBe(429);
		}

		const blocked = await worker.fetch(request, env);
		expect(blocked.status).toBe(429);
	});

	it("accepts valid aggregate payloads", async () => {
		resetRateLimitState();
		const request = new Request(
			"https://api.chefgroep.online/pi-zai/telemetry/v1/aggregate",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(validBody),
			},
		);
		const response = await worker.fetch(request, {});
		expect(response.status).toBe(202);
		await expect(response.json()).resolves.toEqual({
			ok: true,
			day: validBody.day,
		});
	});
});
