import { canonicalizeStablePrefix } from "./fingerprint.js";
const ZAI_PROVIDERS = new Set(["zai", "zai-coding-cn", "zai-platform"]);
export const DYNAMIC_CONTEXT_MARKER = "\n\n--- dynamic context ---\n";
export const DYNAMIC_CONTEXT_MARKERS = [
    "Current git status",
    "Current git diff",
    "Latest test failure",
    "Current timestamp",
    "Ephemeral diagnostics",
    "Context tokens:",
    "Token count:",
];
const VOLATILE_LINE_PREFIXES = DYNAMIC_CONTEXT_MARKERS.map((marker) => marker.toLowerCase());
export function isZaiProvider(provider) {
    return provider !== undefined && ZAI_PROVIDERS.has(provider);
}
export function isZaiModel(model) {
    return model !== undefined && isZaiProvider(model.provider);
}
export function isCodingPlanProvider(provider) {
    return provider === "zai" || provider === "zai-coding-cn";
}
export function isPlatformProvider(provider) {
    return provider === "zai-platform";
}
/** Z.AI does not share implicit cache between Coding Plan and Platform endpoints. */
export function endpointsShareCache(endpointA, endpointB) {
    return endpointA === endpointB;
}
export function isVolatileSystemPromptLine(line) {
    const trimmed = line.trim();
    if (!trimmed)
        return false;
    const lower = trimmed.toLowerCase();
    return VOLATILE_LINE_PREFIXES.some((marker) => lower.startsWith(marker));
}
export function stripVolatileSystemPromptLines(systemPrompt) {
    const lines = systemPrompt.split("\n");
    const stable = lines.filter((line) => !isVolatileSystemPromptLine(line));
    return stable.join("\n");
}
export function splitStableAndDynamicSystemPrompt(systemPrompt) {
    const index = systemPrompt.indexOf(DYNAMIC_CONTEXT_MARKER);
    if (index < 0) {
        return { stable: systemPrompt, dynamic: "" };
    }
    return {
        stable: systemPrompt.slice(0, index),
        dynamic: systemPrompt.slice(index + DYNAMIC_CONTEXT_MARKER.length),
    };
}
export function appendDynamicContext(stablePrompt, dynamicContext) {
    const trimmed = dynamicContext.trim();
    if (!trimmed)
        return stablePrompt;
    return `${stablePrompt}${DYNAMIC_CONTEXT_MARKER}${trimmed}`;
}
/** Classify prompt structure without logging or returning prompt content. */
export function analyzeSystemPromptSections(systemPrompt) {
    const { stable, dynamic } = splitStableAndDynamicSystemPrompt(systemPrompt);
    const stableLines = stable.split("\n");
    let volatileLineCount = dynamic ? dynamic.split("\n").filter((line) => line.trim()).length : 0;
    let inlineVolatile = 0;
    for (const line of stableLines) {
        if (isVolatileSystemPromptLine(line)) {
            inlineVolatile += 1;
        }
    }
    volatileLineCount += inlineVolatile;
    const stableLineCount = Math.max(0, stableLines.length - inlineVolatile);
    const sections = [{ kind: "stable", lineCount: stableLineCount }];
    if (volatileLineCount > 0) {
        sections.push({ kind: "volatile", lineCount: volatileLineCount });
    }
    return {
        stableLineCount,
        volatileLineCount,
        hasDynamicMarker: dynamic.length > 0,
        sections,
    };
}
/** Return canonical stable prefix for fingerprinting; never logs raw prompt text. */
export function canonicalStableSystemPrefix(systemPrompt) {
    const { stable } = splitStableAndDynamicSystemPrompt(systemPrompt);
    return canonicalizeStablePrefix(stripVolatileSystemPromptLines(stable));
}
//# sourceMappingURL=context-policy.js.map