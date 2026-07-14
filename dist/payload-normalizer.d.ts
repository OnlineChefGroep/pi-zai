import type { ZaiConfig } from "./config.ts";
/**
 * Apply only an explicit user override.
 *
 * When preserveThinking is undefined, Pi's native Z.AI payload is returned
 * unchanged. Current Pi releases send clear_thinking=false whenever Z.AI
 * thinking is enabled, which preserves interleaved reasoning across tool turns.
 */
export declare function normalizeZaiThinkingPayload(payload: unknown, config: ZaiConfig): Record<string, unknown> | undefined;
//# sourceMappingURL=payload-normalizer.d.ts.map