import { createHash } from "node:crypto";
export const SHORT_HASH_LENGTH = 16;
const TIMESTAMP_PATTERNS = [
    /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})\b/g,
    /\bCurrent time:.*$/gm,
    /\bLast updated:.*$/gm,
    /\bToken count: \d+\b/g,
    /\bContext tokens: \d+\b/g,
];
const GIT_STATUS_PATTERNS = [
    /^Current git status\b.*$/gm,
    /^## (?:modified|untracked|staged).*/gm,
    /^On branch .+$/gm,
    /^Changes (?:not staged|to be committed).*/gm,
];
export function shortenHash(hex, length = SHORT_HASH_LENGTH) {
    return hex.slice(0, length);
}
export function hashCanonicalText(text) {
    return shortenHash(createHash("sha256").update(text).digest("hex"));
}
/** Strip volatile lines and normalize whitespace before fingerprinting. */
export function canonicalizeStablePrefix(text) {
    let normalized = text.replace(/\r\n/g, "\n").trim();
    for (const pattern of TIMESTAMP_PATTERNS) {
        normalized = normalized.replace(pattern, "");
    }
    for (const pattern of GIT_STATUS_PATTERNS) {
        normalized = normalized.replace(pattern, "");
    }
    return normalized.replace(/\n{2,}/g, "\n").trim();
}
export function fingerprintText(text) {
    return hashCanonicalText(canonicalizeStablePrefix(text));
}
export function fingerprintSystemPrompt(systemPrompt) {
    return fingerprintText(systemPrompt);
}
export function canonicalizeTool(tool) {
    const params = tool.parameters && typeof tool.parameters === "object"
        ? stableJson(tool.parameters)
        : String(tool.parameters ?? "");
    return `${tool.name}\n${tool.description ?? ""}\n${params}`;
}
export function fingerprintToolset(tools) {
    const canonical = tools
        .map(canonicalizeTool)
        .sort((a, b) => a.localeCompare(b))
        .join("\n---\n");
    return hashCanonicalText(canonical);
}
function stableJson(value) {
    if (value === null || typeof value !== "object") {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableJson(item)).join(",")}]`;
    }
    const entries = Object.entries(value).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, val]) => `${JSON.stringify(key)}:${stableJson(val)}`).join(",")}}`;
}
//# sourceMappingURL=fingerprint.js.map