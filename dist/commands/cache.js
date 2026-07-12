import { isZaiModel } from "../cache/context-policy.js";
import { formatCacheDiagnostics, formatCacheResetMessage } from "../cache/diagnostics.js";
import { getCacheMetricsStore, resetCacheMetrics } from "./cache-state.js";
const ACTIONS = ["status", "reset-stats", "explain"];
function parseCacheAction(args) {
    const action = args.trim().toLowerCase();
    if (action === "" || action === "status")
        return "status";
    if (action === "reset-stats")
        return "reset-stats";
    if (action === "explain")
        return "explain";
    return "status";
}
export function registerZaiCacheCommand(pi) {
    pi.registerCommand("zai-cache", {
        description: "Z.AI implicit cache diagnostics (status, reset-stats, explain)",
        getArgumentCompletions: (prefix) => {
            const matches = ACTIONS.filter((value) => value.startsWith(prefix));
            return matches.length > 0 ? matches.map((value) => ({ value, label: value })) : null;
        },
        handler: async (args, ctx) => {
            if (!isZaiModel(ctx.model)) {
                ctx.ui.notify("Cache diagnostics require an active Z.AI model.", "warning");
                return;
            }
            const action = parseCacheAction(args);
            if (action === "reset-stats") {
                resetCacheMetrics();
                ctx.ui.notify(formatCacheResetMessage(), "info");
                return;
            }
            const output = formatCacheDiagnostics({
                stats: getCacheMetricsStore().get(),
                isZaiSession: true,
            }, action);
            ctx.ui.notify(output, "info");
        },
    });
}
//# sourceMappingURL=cache.js.map