import { collectDeferredToolNames } from "./groups.js";
function estimateSchemaBytes(value) {
    try {
        return Buffer.byteLength(JSON.stringify(value ?? null), "utf8");
    }
    catch {
        return 0;
    }
}
export function observeAdaptiveToolImpact(pi, config) {
    const active = new Set(pi.getActiveTools());
    const deferred = collectDeferredToolNames(config);
    let estimatedDeferredSchemaBytes = 0;
    for (const tool of pi.getAllTools()) {
        if (!deferred.has(tool.name))
            continue;
        estimatedDeferredSchemaBytes += estimateSchemaBytes({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
        });
    }
    return {
        activeCount: active.size,
        deferredCount: [...deferred].filter((name) => !active.has(name)).length,
        estimatedDeferredSchemaBytes,
        configuredGroupCount: Object.keys(config.groups).length,
    };
}
//# sourceMappingURL=observe.js.map