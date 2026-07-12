import type { Model } from "@earendil-works/pi-ai";
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import type { ZaiConfig } from "../config.ts";
export type ZaiEndpoint = "coding" | "platform";
export type ZaiCommandDeps = {
    extensionVersion: string;
    getConfig: (cwd?: string) => ZaiConfig;
    resolveCredentialSourceName: (provider: string, ctx: Pick<ExtensionCommandContext, "modelRegistry">) => Promise<string | undefined> | string | undefined;
    resolveModelForEndpoint: (ctx: ExtensionCommandContext, endpoint: ZaiEndpoint, modelId?: string) => Model<any> | undefined;
    isPlatformProviderRegistered: (ctx: ExtensionCommandContext) => boolean;
};
export declare function resolveModelForEndpoint(ctx: ExtensionCommandContext, endpoint: ZaiEndpoint, modelId?: string): Model<any> | undefined;
export declare function isPlatformProviderRegistered(ctx: ExtensionCommandContext): boolean;
//# sourceMappingURL=deps.d.ts.map