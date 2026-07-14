import type { ZaiConfig } from "./config.ts";

type ZaiThinkingPayload = {
	type?: string;
	clear_thinking?: boolean;
};

/**
 * Apply only an explicit user override.
 *
 * When preserveThinking is undefined, Pi's native Z.AI payload is returned
 * unchanged. Current Pi releases send clear_thinking=false whenever Z.AI
 * thinking is enabled, which preserves interleaved reasoning across tool turns.
 */
export function normalizeZaiThinkingPayload(
	payload: unknown,
	config: ZaiConfig,
): Record<string, unknown> | undefined {
	if (payload === null || typeof payload !== "object") {
		return undefined;
	}

	const record = payload as Record<string, unknown>;
	const thinking = record.thinking as ZaiThinkingPayload | undefined;
	if (!thinking || typeof thinking !== "object") {
		return undefined;
	}

	if (thinking.type !== "enabled" || config.preserveThinking === undefined) {
		return undefined;
	}

	const clearThinking = !config.preserveThinking;
	if (thinking.clear_thinking === clearThinking) {
		return undefined;
	}

	return {
		...record,
		thinking: { ...thinking, clear_thinking: clearThinking },
	};
}
