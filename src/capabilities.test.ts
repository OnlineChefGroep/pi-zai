import { describe, expect, it } from "vitest";
import { resolveZaiCapabilities } from "./capabilities.ts";
import type { ZaiModel } from "./zai-model.ts";

function model(
	partial: Partial<ZaiModel> & Pick<ZaiModel, "provider" | "api">,
): ZaiModel {
	return {
		id: partial.id ?? "glm-5.2",
		name: partial.name ?? "GLM 5.2",
		provider: partial.provider,
		api: partial.api,
		baseUrl: partial.baseUrl ?? "https://api.z.ai/api/coding/paas/v4",
		reasoning: partial.reasoning ?? true,
		input: partial.input ?? ["text"],
		cost: partial.cost ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
		contextWindow: partial.contextWindow ?? 200000,
		maxTokens: partial.maxTokens ?? 16384,
		compat: partial.compat,
	} as ZaiModel;
}

describe("resolveZaiCapabilities", () => {
	it("marks native zai/glm-5.2 as full-list fallback with Z.AI thinking", () => {
		const caps = resolveZaiCapabilities(
			model({
				provider: "zai",
				api: "openai-completions",
				compat: {
					thinkingFormat: "zai",
					zaiToolStream: true,
					supportsReasoningEffort: true,
				} as ZaiModel["compat"],
			}),
		);
		expect(caps.providerOwnership).toBe("pi-native");
		expect(caps.apiFamily).toBe("openai-completions");
		expect(caps.usesZaiThinkingFormat).toBe(true);
		expect(caps.streamsToolCalls).toBe(true);
		expect(caps.dynamicToolMode).toBe("full-list-fallback");
		expect(caps.toolChoiceSupportedByApi).toBe(false);
	});

	it("marks zai-coding-cn as Pi-native on the China Coding Plan base URL", () => {
		const caps = resolveZaiCapabilities(
			model({
				provider: "zai-coding-cn",
				api: "openai-completions",
				baseUrl: "https://open.bigmodel.cn/api/coding/paas/v4",
				compat: {
					thinkingFormat: "zai",
					zaiToolStream: true,
					supportsReasoningEffort: true,
				} as ZaiModel["compat"],
			}),
		);
		expect(caps.providerOwnership).toBe("pi-native");
		expect(caps.apiFamily).toBe("openai-completions");
		expect(caps.dynamicToolMode).toBe("full-list-fallback");
		expect(caps.usesZaiThinkingFormat).toBe(true);
		expect(caps.streamsToolCalls).toBe(true);
	});

	it("marks zai-platform as platform ownership", () => {
		const caps = resolveZaiCapabilities(
			model({ provider: "zai-platform", api: "openai-completions" }),
		);
		expect(caps.providerOwnership).toBe("platform");
		expect(caps.dynamicToolMode).toBe("full-list-fallback");
	});

	it("recognizes glm-5v-turbo style vision metadata without ownership claims", () => {
		const caps = resolveZaiCapabilities(
			model({
				id: "glm-5v-turbo",
				provider: "zai",
				api: "openai-completions",
				input: ["text", "image"],
				compat: {
					thinkingFormat: "zai",
					zaiToolStream: true,
				} as ZaiModel["compat"],
			}),
		);
		expect(caps.providerOwnership).toBe("pi-native");
		expect(caps.streamsToolCalls).toBe(true);
	});

	it("resolves OpenAI Responses tool search as deferred", () => {
		const caps = resolveZaiCapabilities(
			model({
				provider: "openai",
				api: "openai-responses",
				compat: { supportsToolSearch: true } as ZaiModel["compat"],
			}),
		);
		expect(caps.providerOwnership).toBe("other");
		expect(caps.dynamicToolMode).toBe("deferred");
		expect(caps.toolChoiceSupportedByApi).toBe(true);
	});

	it("resolves Anthropic tool references as deferred", () => {
		const caps = resolveZaiCapabilities(
			model({
				provider: "anthropic",
				api: "anthropic-messages",
				compat: { supportsToolReferences: true } as ZaiModel["compat"],
			}),
		);
		expect(caps.dynamicToolMode).toBe("deferred");
	});

	it("fails closed for unknown custom OpenAI-compatible models", () => {
		const caps = resolveZaiCapabilities(
			model({ provider: "custom-proxy", api: "openai-completions" }),
		);
		expect(caps.providerOwnership).toBe("other");
		expect(caps.dynamicToolMode).toBe("full-list-fallback");
		expect(caps.usesZaiThinkingFormat).toBe(false);
	});

	it("reports pi-zai affinity source only when experimental and managed", () => {
		const caps = resolveZaiCapabilities(
			model({ provider: "zai", api: "openai-completions" }),
			"experimental",
		);
		expect(caps.sessionAffinitySource).toBe("pi-zai");
		expect(caps.sessionAffinityFormat).toBe("x-session-id");
	});
});
