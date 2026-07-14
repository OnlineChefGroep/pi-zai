import { LOADER_TOOL_NAME } from "./types.js";
export function resolveExistingToolNames(pi, names) {
    const available = new Set(pi.getAllTools().map((tool) => tool.name));
    return names.filter((name) => available.has(name) || name === LOADER_TOOL_NAME);
}
export function collectDeferredToolNames(config) {
    const deferred = new Set();
    for (const tools of Object.values(config.groups)) {
        for (const name of tools)
            deferred.add(name);
    }
    for (const name of config.alwaysActive) {
        deferred.delete(name);
    }
    deferred.delete(LOADER_TOOL_NAME);
    return deferred;
}
export function resolveGroupTools(config, group) {
    const tools = config.groups[group];
    return tools ? [...tools] : undefined;
}
export function listConfiguredGroups(config) {
    return Object.keys(config.groups).sort((a, b) => a.localeCompare(b));
}
//# sourceMappingURL=groups.js.map