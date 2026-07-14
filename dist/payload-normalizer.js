/**
 * Apply only an explicit user override.
 *
 * When preserveThinking is undefined, Pi's native Z.AI payload is returned
 * unchanged. Current Pi releases send clear_thinking=false whenever Z.AI
 * thinking is enabled, which preserves interleaved reasoning across tool turns.
 */
export function normalizeZaiThinkingPayload(payload, config) {
    if (payload === null || typeof payload !== "object") {
        return undefined;
    }
    const record = payload;
    const thinking = record.thinking;
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
//# sourceMappingURL=payload-normalizer.js.map