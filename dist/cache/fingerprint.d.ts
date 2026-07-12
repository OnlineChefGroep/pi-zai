export declare const SHORT_HASH_LENGTH = 16;
export declare function shortenHash(hex: string, length?: number): string;
export declare function hashCanonicalText(text: string): string;
/** Strip volatile lines and normalize whitespace before fingerprinting. */
export declare function canonicalizeStablePrefix(text: string): string;
export declare function fingerprintText(text: string): string;
export declare function fingerprintSystemPrompt(systemPrompt: string): string;
export type ToolFingerprintInput = {
    name: string;
    description?: string;
    parameters?: unknown;
};
export declare function canonicalizeTool(tool: ToolFingerprintInput): string;
export declare function fingerprintToolset(tools: ToolFingerprintInput[]): string;
//# sourceMappingURL=fingerprint.d.ts.map