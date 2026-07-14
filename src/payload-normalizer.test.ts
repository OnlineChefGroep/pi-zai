import { describe, expect, it } from "vitest";
import { loadZaiConfig } from "./config.ts";
import { normalizeZaiThinkingPayload } from "./payload-normalizer.ts";

describe("normalizeZaiThinkingPayload", () => {
	const native = { ...loadZaiConfig(), preserveThinking: undefined };
	const forceClear = { ...loadZaiConfig(), preserveThinking: false };
	const forcePreserve = { ...loadZaiConfig(), preserveThinking: true };

	it("leaves Pi native preserved thinking unchanged by default", () => {
		const result = normalizeZaiThinkingPayload(
			{ thinking: { type: "enabled", clear_thinking: false } },
			native,
		);
		expect(result).toBeUndefined();
	});

	it("does not silently replace a future Pi native payload", () => {
		const result = normalizeZaiThinkingPayload(
			{ thinking: { type: "enabled", clear_thinking: true } },
			native,
		);
		expect(result).toBeUndefined();
	});

	it("forces clear_thinking=true only for an explicit false override", () => {
		const result = normalizeZaiThinkingPayload(
			{ thinking: { type: "enabled", clear_thinking: false } },
			forceClear,
		);
		expect(result?.thinking).toEqual({ type: "enabled", clear_thinking: true });
	});

	it("forces clear_thinking=false for an explicit true override", () => {
		const result = normalizeZaiThinkingPayload(
			{ thinking: { type: "enabled", clear_thinking: true } },
			forcePreserve,
		);
		expect(result?.thinking).toEqual({
			type: "enabled",
			clear_thinking: false,
		});
	});

	it("does not add clear_thinking when thinking is disabled", () => {
		const result = normalizeZaiThinkingPayload(
			{ thinking: { type: "disabled" } },
			forceClear,
		);
		expect(result).toBeUndefined();
	});
});
