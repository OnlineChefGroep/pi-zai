import { isCodingPlanProvider, isPlatformProvider, isZaiModel } from "../cache/context-policy.js";
import { endpointLabel } from "../cache/metrics.js";
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
        return "true (thinking disabled)";
    }
    if (config.preserveThinking) {
        return "false (preserved thinking enabled)";
    }
    return "true (default cost-first)";
}
export function describePreservedThinking(config) {
    const source = process.env.PI_ZAI_PRESERVE_THINKING !== undefined ? "PI_ZAI_PRESERVE_THINKING" : "settings.json or default";
    if (config.preserveThinking) {
        return `enabled via ${source}`;
    }
    return `disabled (default; source: ${source})`;
}
export function describeThinkingPayload(config, thinkingLevel, model) {
    if (!model?.reasoning) {
        return "thinking disabled (non-reasoning model)";
    }
    const clearThinking = thinkingLevel !== "off" && config.preserveThinking ? "false" : "true";
    if (thinkingLevel === "off") {
        return 'type="disabled", clear_thinking=true';
    }
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
        if (assistant.stopReason === "aborted" || assistant.stopReason === "error")
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
        const usage = assistant.usage;
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
    const auth = ctx.modelRegistry.getProviderAuthStatus(provider);
    if (!auth.configured)
        return "not configured";
    if (auth.source === "environment" && auth.label)
        return auth.label;
    if (auth.source === "models_json_command")
        return "models.json (command)";
    if (auth.source === "models_json_key")
        return "models.json (key)";
    if (auth.source === "stored")
        return "auth.json";
    if (auth.source === "runtime")
        return "runtime";
    if (auth.source === "fallback")
        return "fallback";
    return auth.source ?? "configured";
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
        `input=${formatTokens(usage.input)}`,
        `cacheRead=${formatTokens(usage.cacheRead)}`,
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
        return { error: `Active model ${ctx.model.provider}/${ctx.model.id} is not a Z.AI provider.` };
    }
    return { model: ctx.model };
}
//# sourceMappingURL=helpers.js.map