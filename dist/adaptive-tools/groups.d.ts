import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ZaiAdaptiveToolsConfig } from "../config.ts";
export declare function resolveExistingToolNames(pi: ExtensionAPI, names: string[]): string[];
export declare function collectDeferredToolNames(config: ZaiAdaptiveToolsConfig): Set<string>;
export declare function resolveGroupTools(config: ZaiAdaptiveToolsConfig, group: string): string[] | undefined;
export declare function listConfiguredGroups(config: ZaiAdaptiveToolsConfig): string[];
//# sourceMappingURL=groups.d.ts.map