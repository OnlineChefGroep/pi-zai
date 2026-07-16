import { describe, expect, it } from "vitest";
import { createZaiModel } from "../../test/mock-extension-api.ts";
import { resolveProbeTarget } from "./capabilities.ts";

describe("resolveProbeTarget", () => {
	it("allows the canonical global Coding Plan host", () => {
		expect(resolveProbeTarget(createZaiModel())).toMatchObject({
			host: "api.z.ai",
			requiresHostConfirmation: false,
		});
	});

	it("rejects non-HTTPS and unexpected native hosts before auth resolution", () => {
		expect(() =>
			resolveProbeTarget({
				...createZaiModel(),
				baseUrl: "http://api.z.ai/api/coding/paas/v4",
			}),
		).toThrow("HTTPS");
		expect(() =>
			resolveProbeTarget({
				...createZaiModel(),
				baseUrl: "https://example.invalid/api/coding/paas/v4",
			}),
		).toThrow("unexpected host");
	});

	it("requires an explicit host confirmation for Platform probes", () => {
		const target = resolveProbeTarget({
			...createZaiModel(),
			provider: "zai-platform",
			baseUrl: "https://gateway.example.test/zai/v4",
		});
		expect(target).toEqual({
			endpoint: "https://gateway.example.test/zai/v4/chat/completions",
			host: "gateway.example.test",
			requiresHostConfirmation: true,
		});
	});
});
