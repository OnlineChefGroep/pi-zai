import type { AgentMessage } from "@earendil-works/pi-agent-core";
export declare const ZAI_COMPACTION_SECTIONS: readonly ["## Stable project facts", "## Decisions and outcomes", "## Current task progress"];
/**
 * Deterministic Z.AI-aware compaction instructions.
 * No timestamps; preserves visible outcomes; drops hidden reasoning by default.
 */
export declare function buildCompactionInstructions(): string;
export type CompactionHookOptions = {
    customInstructions: string;
    replaceInstructions: boolean;
    dropHiddenReasoning: boolean;
};
export declare function getCompactionHookOptions(): CompactionHookOptions;
/** Apply Z.AI compaction focus to Pi's mutable compact event payload. */
export declare function applyZaiCompactionInstructions(event: {
    customInstructions?: string;
}): void;
/** Apply Z.AI branch-summary focus for tree navigation. */
export declare function applyZaiTreeSummaryInstructions(): {
    customInstructions: string;
    replaceInstructions: boolean;
};
export declare function stripHiddenReasoningFromMessages(messages: AgentMessage[]): AgentMessage[];
export declare function prepareMessagesForCompaction(messages: AgentMessage[], options?: Pick<CompactionHookOptions, "dropHiddenReasoning">): AgentMessage[];
export declare function compactionDropsHiddenReasoning(messages: AgentMessage[]): boolean;
export declare function compactionPreservesVisibleOutcomes(messages: AgentMessage[]): boolean;
//# sourceMappingURL=compaction.d.ts.map