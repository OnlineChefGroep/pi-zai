import { loadZaiConfig } from "../config.js";
import { formatPiCredentialSource } from "../credentials.js";
import { registerZaiBenchmarkCommand } from "./benchmark.js";
import { registerZaiCacheCommand } from "./cache.js";
import { registerZaiCapabilitiesCommand } from "./capabilities.js";
import { registerZaiDataCommand } from "./data.js";
import { isPlatformProviderRegistered, resolveModelForEndpoint, } from "./deps.js";
import { registerZaiDoctorCommand } from "./doctor.js";
import { registerZaiEndpointCommand } from "./endpoint.js";
import { registerZaiPrivacyCommand } from "./privacy.js";
import { registerZaiStatusCommand } from "./status.js";
import { registerZaiTelemetryCommand } from "./telemetry.js";
import { registerZaiTransportCommand } from "./transport.js";
import { registerZaiUsageCommand } from "./usage.js";
export { isPlatformProviderRegistered, resolveModelForEndpoint };
export function registerZaiCommands(pi, deps) {
    registerZaiStatusCommand(pi, deps);
    registerZaiEndpointCommand(pi, deps);
    registerZaiCacheCommand(pi);
    registerZaiDataCommand(pi, deps);
    registerZaiUsageCommand(pi, deps);
    registerZaiDoctorCommand(pi, deps);
    registerZaiCapabilitiesCommand(pi, deps);
    registerZaiPrivacyCommand(pi, deps);
    registerZaiTransportCommand(pi);
    registerZaiBenchmarkCommand(pi, deps);
    registerZaiTelemetryCommand(pi, deps);
}
export function createDefaultZaiCommandDeps(extensionVersion) {
    return {
        extensionVersion,
        getConfig: loadZaiConfig,
        resolveCredentialSourceName: (provider, ctx) => formatPiCredentialSource(provider, ctx.modelRegistry),
        resolveModelForEndpoint,
        isPlatformProviderRegistered,
    };
}
//# sourceMappingURL=index.js.map