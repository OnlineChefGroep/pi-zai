import { getBuiltinModels } from "@earendil-works/pi-ai/providers/all";
import { buildPlatformApiKeyCommand } from "./credentials.js";
import { buildPlatformModelCatalog, PLATFORM_BASE_URL } from "./model-catalog.js";
const CODING_PLAN_API_KEYS = {
    zai: "$ZAI_API_KEY",
    "zai-coding-cn": "$ZAI_CODING_CN_API_KEY",
};
function isZaiOpenAICompat(model) {
    if (model.api !== "openai-completions")
        return false;
    const compat = model.compat;
    return compat?.thinkingFormat === "zai";
}
function toProviderModelConfig(model, preserveThinking) {
    const compat = isZaiOpenAICompat(model) && preserveThinking
        ? { ...model.compat, zaiPreserveThinking: true }
        : model.compat;
    return {
        id: model.id,
        name: model.name,
        api: model.api,
        baseUrl: model.baseUrl,
        reasoning: model.reasoning ?? false,
        thinkingLevelMap: model.thinkingLevelMap,
        input: model.input,
        cost: model.cost,
        contextWindow: model.contextWindow,
        maxTokens: model.maxTokens,
        headers: model.headers,
        compat,
    };
}
function builtinZaiModels(provider) {
    return getBuiltinModels(provider);
}
export function registerZaiPlatformProvider(pi, config) {
    pi.registerProvider("zai-platform", {
        name: "Z.AI Platform API",
        baseUrl: PLATFORM_BASE_URL,
        apiKey: buildPlatformApiKeyCommand(),
        api: "openai-completions",
        authHeader: true,
        models: buildPlatformModelCatalog({ preserveThinking: config.preserveThinking }),
    });
}
export function applyPreserveThinkingOverrides(pi) {
    for (const provider of Object.keys(CODING_PLAN_API_KEYS)) {
        const models = builtinZaiModels(provider).map((model) => toProviderModelConfig(model, true));
        if (models.length === 0)
            continue;
        const sample = builtinZaiModels(provider)[0];
        pi.registerProvider(provider, {
            baseUrl: sample?.baseUrl,
            apiKey: CODING_PLAN_API_KEYS[provider],
            api: "openai-completions",
            authHeader: true,
            models,
        });
    }
    registerZaiPlatformProvider(pi, { preserveThinking: true });
}
export function clearPreserveThinkingOverrides(pi, config) {
    pi.unregisterProvider("zai");
    pi.unregisterProvider("zai-coding-cn");
    registerZaiPlatformProvider(pi, config);
}
export function syncProviderRegistration(pi, config) {
    if (config.preserveThinking) {
        applyPreserveThinkingOverrides(pi);
        return;
    }
    clearPreserveThinkingOverrides(pi, config);
}
//# sourceMappingURL=platform-provider.js.map