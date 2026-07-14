import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { type ToolFingerprintInput } from "./fingerprint.ts";
export type ToolsetTransitionClass = "unchanged" | "tools-added" | "tools-removed" | "tool-schema-changed" | "tool-description-changed" | "toolset-reordered-only" | "unknown-change";
export type ToolsetSnapshot = {
    count: number;
    fingerprint: string;
    tools: ToolFingerprintInput[];
};
export type ToolsetTransition = {
    classification: ToolsetTransitionClass;
    previousCount: number;
    nextCount: number;
    addedCount: number;
    removedCount: number;
    changed: boolean;
};
export declare function captureActiveToolset(pi: ExtensionAPI): ToolsetSnapshot;
export declare function classifyToolsetTransition(previous: ToolsetSnapshot | undefined, next: ToolsetSnapshot): ToolsetTransition;
//# sourceMappingURL=toolset-snapshot.d.ts.map