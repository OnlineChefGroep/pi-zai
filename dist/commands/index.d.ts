import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { isPlatformProviderRegistered, resolveModelForEndpoint, type ZaiCommandDeps } from "./deps.ts";
export type { ZaiCommandDeps, ZaiEndpoint } from "./deps.ts";
export { isPlatformProviderRegistered, resolveModelForEndpoint };
export declare function registerZaiCommands(pi: ExtensionAPI, deps: ZaiCommandDeps): void;
export declare function createDefaultZaiCommandDeps(extensionVersion: string): ZaiCommandDeps;
//# sourceMappingURL=index.d.ts.map