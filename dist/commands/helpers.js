import { isCodingPlanProvider, isPlatformProvider, isZaiModel, isZaiProvider, } from "../cache/context-policy.js";
import { endpointLabel } from "../cache/metrics.js";
import { formatPiCredentialSource } from "../credentials.js";
export function getZaiCompat(model) {
    return model?.compat;
}
export function formatPercent(ratio) {
    return `${(ratio * 100).toFixed(1)}%`;
}
export function formatTokens(count) {
    return count.toLocaleString("en-US");
}
export function formatDollarCost(amount) {
    if (amount <= 0)
        return "$0.00";
    return `$${amount.toFixed(4)}`;
}
export function getEndpointLabel(model) {
    return endpointLabel(model.provider, model.baseUrl);
}
export function describeClearThinking(config, thinkingLevel, model) {
    if (!model?.reasoning) {
        return "n/a (model has no reasoning)";
    }
    if (thinkingLevel === "off") {
        return "not sent (thinking disabled)";
    }
    if (config.preserveThinking === true) {
        return "false (forced preserved via settings)";
    }
    if (config.preserveThinking === false) {
        return "true (forced clear via settings)";
    }
    return "false (Pi native)";
}
export function describePreservedThinking(config) {
    if (config.preserveThinking === true) {
        return "forced on via settings.json";
    }
    if (config.preserveThinking === false) {
        return "forced off via settings.json";
    }
    return "native Pi behavior";
}
export function describeThinkingPayload(config, thinkingLevel, model) {
    if (!model?.reasoning) {
        return "thinking disabled (non-reasoning model)";
    }
    if (thinkingLevel === "off") {
        return 'type="disabled"';
    }
    const clearThinking = config.preserveThinking === false ? "true" : "false";
    const mapped = model.thinkingLevelMap?.[thinkingLevel];
    const effort = typeof mapped === "string" ? mapped : thinkingLevel;
    return `type="enabled", reasoning_effort="${effort}", clear_thinking=${clearThinking}`;
}
export function getLastAssistantUsage(ctx) {
    for (let i = ctx.sessionManager.getBranch().length - 1; i >= 0; i -= 1) {
        const entry = ctx.sessionManager.getBranch()[i];
        if (entry.type !== "message" || entry.message.role !== "assistant")
            continue;
        const assistant = entry.message;
        if (!isZaiProvider(assistant.provider))
            continue;
        if (assistant.stopReason === "aborted" || assistant.stopReason === "error")
            continue;
        const promptTokens = assistant.usage.input +
            assistant.usage.cacheRead +
            assistant.usage.cacheWrite;
        if (promptTokens <= 0)
            continue;
        return assistant.usage;
    }
    return undefined;
}
export function getSessionUsageTotals(ctx) {
    const totals = {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        cost: 0,
        requests: 0,
    };
    for (const entry of ctx.sessionManager.getEntries()) {
        if (entry.type !== "message" || entry.message.role !== "assistant")
            continue;
        const assistant = entry.message;
        if (!isZaiProvider(assistant.provider))
            continue;
        const usage = assistant.usage;
        const promptTokens = usage.input + usage.cacheRead + usage.cacheWrite;
        if (promptTokens <= 0 && usage.output <= 0)
            continue;
        totals.input += usage.input;
        totals.output += usage.output;
        totals.cacheRead += usage.cacheRead;
        totals.cacheWrite += usage.cacheWrite;
        totals.cost += usage.cost.total;
        totals.requests += 1;
    }
    return totals;
}
export function formatCredentialSource(provider, ctx) {
    return formatPiCredentialSource(provider, ctx.modelRegistry);
}
export function isSubscriptionManaged(model) {
    return model !== undefined && isCodingPlanProvider(model.provider);
}
export function isEstimatedCost(model) {
    return model !== undefined && isPlatformProvider(model.provider);
}
export function formatUsageLine(usage) {
    const promptTotal = usage.input + usage.cacheRead + usage.cacheWrite;
    const hitRatio = promptTotal > 0 ? usage.cacheRead / promptTotal : 0;
    return [
        `uncached=${formatTokens(usage.input)}`,
        `cached=${formatTokens(usage.cacheRead)}`,
        `cacheWrite=${formatTokens(usage.cacheWrite)}`,
        `output=${formatTokens(usage.output)}`,
        `hit=${formatPercent(hitRatio)}`,
        `cost=${formatDollarCost(usage.cost.total)}`,
    ].join(", ");
}
export function requireZaiModel(ctx) {
    if (!ctx.model) {
        return { error: "No model selected. Choose a Z.AI model first." };
    }
    if (!isZaiModel(ctx.model)) {
        return {
            error: `Active model ${ctx.model.provider}/${ctx.model.id} is not a Z.AI provider.`,
        };
    }
    return { model: ctx.model };
}
//# sourceMappingURL=helpers.js.map