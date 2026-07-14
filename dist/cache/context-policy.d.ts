import type { ZaiModel } from "../zai-model.ts";
export declare const DYNAMIC_CONTEXT_MARKER = "\n\n--- dynamic context ---\n";
export declare const DYNAMIC_CONTEXT_MARKERS: readonly ["Current git status", "Current git diff", "Latest test failure", "Current timestamp", "Ephemeral diagnostics", "Context tokens:", "Token count:"];
export declare function isZaiProvider(provider: string | undefined): boolean;
export declare function isZaiModel(model: ZaiModel | undefined): boolean;
export declare function isCodingPlanProvider(provider: string): boolean;
export declare function isPlatformProvider(provider: string): boolean;
/** Z.AI does not share implicit cache between Coding Plan and Platform endpoints. */
export declare function endpointsShareCache(endpointA: string, endpointB: string): boolean;
export declare function isVolatileSystemPromptLine(line: string): boolean;
export declare function stripVolatileSystemPromptLines(systemPrompt: string): string;
export declare function splitStableAndDynamicSystemPrompt(systemPrompt: string): {
    stable: string;
    dynamic: string;
};
export declare function appendDynamicContext(stablePrompt: string, dynamicContext: string): string;
export type SystemPromptSectionKind = "stable" | "volatile";
export type SystemPromptSection = {
    kind: SystemPromptSectionKind;
    lineCount: number;
};
/** Classify prompt structure without logging or returning prompt content. */
export declare function analyzeSystemPromptSections(systemPrompt: string): {
    stableLineCount: number;
    volatileLineCount: number;
    hasDynamicMarker: boolean;
    sections: SystemPromptSection[];
};
/** Return canonical stable prefix for fingerprinting; never logs raw prompt text. */
export declare function canonicalStableSystemPrefix(systemPrompt: string): string;
//# sourceMappingURL=context-policy.d.ts.map