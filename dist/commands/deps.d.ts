import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { ZaiConfig } from "../config.ts";
import type { ZaiModel } from "../zai-model.ts";
export type ZaiEndpoint = "coding" | "platform";
export type ZaiCommandDeps = {
    extensionVersion: string;
    getConfig: (cwd?: string) => ZaiConfig;
    resolveCredentialSourceName: (provider: string, ctx: Pick<ExtensionCommandContext, "modelRegistry">) => Promise<string | undefined> | string | undefined;
    resolveModelForEndpoint: (ctx: ExtensionCommandContext, endpoint: ZaiEndpoint, modelId?: string) => ZaiModel | undefined;
    isPlatformProviderRegistered: (ctx: ExtensionCommandContext) => boolean;
};
export declare function resolveModelForEndpoint(ctx: ExtensionCommandContext, endpoint: ZaiEndpoint, modelId?: string): ZaiModel | undefined;
export declare function isPlatformProviderRegistered(ctx: ExtensionCommandContext): boolean;
//# sourceMappingURL=deps.d.ts.map