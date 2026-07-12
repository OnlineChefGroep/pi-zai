export function resolveModelForEndpoint(ctx, endpoint, modelId = ctx.model?.id ?? "glm-5.2") {
    const provider = endpoint === "platform" ? "zai-platform" : "zai";
    return ctx.modelRegistry.find(provider, modelId);
}
export function isPlatformProviderRegistered(ctx) {
    return ctx.modelRegistry.find("zai-platform", "glm-5.2") !== undefined;
}
//# sourceMappingURL=deps.js.map