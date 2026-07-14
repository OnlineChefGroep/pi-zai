import { getBuiltinModels } from "@earendil-works/pi-ai/providers/all";
import { describe, expect, it } from "vitest";
import { resolveZaiCapabilities } from "./capabilities.ts";
import type { ZaiModel } from "./zai-model.ts";

function asModelList(value: unknown): ZaiModel[] {
	if (Array.isArray(value)) return value as ZaiModel[];
	if (value && typeof value === "object") {
		return Object.values(value as Record<string, ZaiModel>);
	}
	return [];
}

describe("installed Pi Z.AI model contract", () => {
	const models = asModelList(getBuiltinModels("zai"));

	it("exposes glm-5.2 on openai-completions with Z.AI thinking and tool stream", () => {
		const glm52 = models.find((model) => model.id === "glm-5.2");
		expect(glm52).toBeTruthy();
		expect(glm52?.api).toBe("openai-completions");
		expect(glm52?.provider).toBe("zai");
		const compat = glm52?.compat as Record<string, unknown> | undefined;
		expect(compat?.thinkingFormat).toBe("zai");
		expect(compat?.zaiToolStream).toBe(true);
		expect(glm52?.thinkingLevelMap).toMatchObject({
			low: "high",
			medium: "high",
			high: "high",
			max: "max",
		});
		const caps = resolveZaiCapabilities(glm52);
		expect(caps.providerOwnership).toBe("pi-native");
		expect(caps.dynamicToolMode).toBe("full-list-fallback");
		expect(caps.usesZaiThinkingFormat).toBe(true);
		expect(caps.streamsToolCalls).toBe(true);
		expect(caps.toolChoiceSupportedByApi).toBe(false);
	});

	it("recognizes glm-5v-turbo as text+image without extension ownership", () => {
		const vision = models.find((model) => model.id === "glm-5v-turbo");
		expect(vision).toBeTruthy();
		expect(vision?.api).toBe("openai-completions");
		expect(vision?.input).toEqual(expect.arrayContaining(["text", "image"]));
		const caps = resolveZaiCapabilities(vision);
		expect(caps.providerOwnership).toBe("pi-native");
		expect(caps.dynamicToolMode).toBe("full-list-fallback");
	});
});
