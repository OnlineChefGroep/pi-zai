import type { ZaiModel } from "./zai-model.ts";

const PI_NATIVE_ZAI_PROVIDERS = new Set(["zai", "zai-coding-cn"]);
const PLATFORM_ZAI_PROVIDERS = new Set(["zai-platform"]);
const MANAGED_ZAI_PROVIDERS = new Set([
	...PI_NATIVE_ZAI_PROVIDERS,
	...PLATFORM_ZAI_PROVIDERS,
]);

export function isPiNativeZaiProvider(provider: string | undefined): boolean {
	return provider !== undefined && PI_NATIVE_ZAI_PROVIDERS.has(provider);
}

export function isZaiPlatformProvider(provider: string | undefined): boolean {
	return provider !== undefined && PLATFORM_ZAI_PROVIDERS.has(provider);
}

export function isManagedZaiProvider(provider: string | undefined): boolean {
	return provider !== undefined && MANAGED_ZAI_PROVIDERS.has(provider);
}

/** True when the active model uses Pi's built-in Z.AI providers (not platform). */
export function isNativeZaiModel(model: ZaiModel | undefined): boolean {
	return model !== undefined && isPiNativeZaiProvider(model.provider);
}

export function isManagedZaiModel(model: ZaiModel | undefined): boolean {
	return model !== undefined && isManagedZaiProvider(model.provider);
}

export function isZaiPlatformModel(model: ZaiModel | undefined): boolean {
	return model !== undefined && isZaiPlatformProvider(model.provider);
}
