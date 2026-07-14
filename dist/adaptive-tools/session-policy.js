import { sessionState } from "../state.js";
import { collectDeferredToolNames, resolveExistingToolNames, } from "./groups.js";
import { registerAdaptiveLoaderTool } from "./loader-tool.js";
import { observeAdaptiveToolImpact } from "./observe.js";
import { LOADER_TOOL_NAME } from "./types.js";
let loaderRegistered = false;
export function applyAdaptiveToolsSessionPolicy(pi, config) {
    sessionState.adaptiveTools = {
        mode: config.mode,
        loaderInvocations: sessionState.adaptiveTools?.loaderInvocations ?? 0,
        lastAddedCount: sessionState.adaptiveTools?.lastAddedCount ?? 0,
    };
    if (config.mode === "off") {
        return;
    }
    if (config.mode === "observe") {
        // Observe only: keep active tools unchanged and do not register loader.
        observeAdaptiveToolImpact(pi, config);
        return;
    }
    if (config.mode !== "manual") {
        return;
    }
    if (!loaderRegistered) {
        registerAdaptiveLoaderTool(pi, () => config);
        loaderRegistered = true;
    }
    const deferred = collectDeferredToolNames(config);
    const alwaysActive = new Set(resolveExistingToolNames(pi, [...config.alwaysActive, LOADER_TOOL_NAME]));
    const current = pi.getActiveTools();
    const next = current.filter((name) => {
        if (alwaysActive.has(name))
            return true;
        if (deferred.has(name))
            return false;
        // Preserve foreign / ungrouped tools owned by Pi or other extensions.
        return true;
    });
    for (const name of alwaysActive) {
        if (!next.includes(name) &&
            (name === LOADER_TOOL_NAME ||
                pi.getAllTools().some((tool) => tool.name === name))) {
            next.push(name);
        }
    }
    // Ensure loader is active even if getAllTools has not refreshed yet.
    if (!next.includes(LOADER_TOOL_NAME)) {
        next.push(LOADER_TOOL_NAME);
    }
    const capped = config.maxInitialTools > 0 && next.length > config.maxInitialTools
        ? [
            ...next.filter((name) => alwaysActive.has(name) || name === LOADER_TOOL_NAME),
            ...next
                .filter((name) => !alwaysActive.has(name) && name !== LOADER_TOOL_NAME)
                .slice(0, Math.max(0, config.maxInitialTools -
                [...alwaysActive, LOADER_TOOL_NAME].length)),
        ]
        : next;
    pi.setActiveTools([...new Set(capped)]);
}
//# sourceMappingURL=session-policy.js.map