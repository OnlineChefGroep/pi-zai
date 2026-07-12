import { loadZaiConfig } from "../config.js";
import { resolveCredentialSourceForProvider } from "../credentials.js";
import { registerZaiCacheCommand } from "./cache.js";
import { isPlatformProviderRegistered, resolveModelForEndpoint } from "./deps.js";
import { registerZaiDoctorCommand } from "./doctor.js";
import { registerZaiEndpointCommand } from "./endpoint.js";
import { registerZaiStatusCommand } from "./status.js";
import { registerZaiUsageCommand } from "./usage.js";
export { isPlatformProviderRegistered, resolveModelForEndpoint };
export function registerZaiCommands(pi, deps) {
    registerZaiStatusCommand(pi, deps);
    registerZaiEndpointCommand(pi, deps);
    registerZaiCacheCommand(pi);
    registerZaiUsageCommand(pi);
    registerZaiDoctorCommand(pi, deps);
}
export function createDefaultZaiCommandDeps(extensionVersion) {
    return {
        extensionVersion,
        getConfig: loadZaiConfig,
        resolveCredentialSourceName: (provider, ctx) => resolveCredentialSourceForProvider(provider, ctx.modelRegistry),
        resolveModelForEndpoint,
        isPlatformProviderRegistered,
    };
}
//# sourceMappingURL=index.js.map