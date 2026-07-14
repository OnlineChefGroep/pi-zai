import { fingerprintToolset, } from "./fingerprint.js";
function stableParams(value) {
    if (value === null || typeof value !== "object") {
        return JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map((item) => stableParams(item)).join(",")}]`;
    }
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries
        .map(([key, val]) => `${JSON.stringify(key)}:${stableParams(val)}`)
        .join(",")}}`;
}
function toolIdentityKey(tool) {
    return tool.name;
}
function toolContentKey(tool) {
    return {
        description: tool.description ?? "",
        parameters: stableParams(tool.parameters ?? null),
    };
}
export function captureActiveToolset(pi) {
    try {
        const active = new Set(pi.getActiveTools());
        const tools = pi
            .getAllTools()
            .filter((tool) => active.has(tool.name))
            .map((tool) => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
        }))
            .sort((left, right) => left.name.localeCompare(right.name));
        return {
            count: tools.length,
            fingerprint: fingerprintToolset(tools),
            tools,
        };
    }
    catch {
        return {
            count: 0,
            fingerprint: fingerprintToolset([]),
            tools: [],
        };
    }
}
export function classifyToolsetTransition(previous, next) {
    if (!previous) {
        return {
            classification: "unchanged",
            previousCount: next.count,
            nextCount: next.count,
            addedCount: 0,
            removedCount: 0,
            changed: false,
        };
    }
    if (previous.fingerprint === next.fingerprint) {
        return {
            classification: "unchanged",
            previousCount: previous.count,
            nextCount: next.count,
            addedCount: 0,
            removedCount: 0,
            changed: false,
        };
    }
    const previousByName = new Map(previous.tools.map((tool) => [toolIdentityKey(tool), tool]));
    const nextByName = new Map(next.tools.map((tool) => [toolIdentityKey(tool), tool]));
    let addedCount = 0;
    let removedCount = 0;
    let schemaChanged = false;
    let descriptionChanged = false;
    for (const name of nextByName.keys()) {
        if (!previousByName.has(name))
            addedCount += 1;
    }
    for (const name of previousByName.keys()) {
        if (!nextByName.has(name))
            removedCount += 1;
    }
    for (const [name, nextTool] of nextByName) {
        const previousTool = previousByName.get(name);
        if (!previousTool)
            continue;
        const prevContent = toolContentKey(previousTool);
        const nextContent = toolContentKey(nextTool);
        if (prevContent.parameters !== nextContent.parameters) {
            schemaChanged = true;
        }
        else if (prevContent.description !== nextContent.description) {
            descriptionChanged = true;
        }
    }
    const sameNames = addedCount === 0 &&
        removedCount === 0 &&
        previous.tools.length === next.tools.length;
    let classification;
    if (sameNames && !schemaChanged && !descriptionChanged) {
        classification = "toolset-reordered-only";
    }
    else if (addedCount > 0 &&
        removedCount === 0 &&
        !schemaChanged &&
        !descriptionChanged) {
        classification = "tools-added";
    }
    else if (removedCount > 0 &&
        addedCount === 0 &&
        !schemaChanged &&
        !descriptionChanged) {
        classification = "tools-removed";
    }
    else if (schemaChanged) {
        classification = "tool-schema-changed";
    }
    else if (descriptionChanged) {
        classification = "tool-description-changed";
    }
    else {
        classification = "unknown-change";
    }
    const changed = classification !== "toolset-reordered-only";
    return {
        classification: changed ? classification : "unchanged",
        previousCount: previous.count,
        nextCount: next.count,
        addedCount,
        removedCount,
        changed,
    };
}
//# sourceMappingURL=toolset-snapshot.js.map