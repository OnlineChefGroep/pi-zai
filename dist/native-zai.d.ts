import type { ZaiModel } from "./zai-model.ts";
export declare function isPiNativeZaiProvider(provider: string | undefined): boolean;
export declare function isZaiPlatformProvider(provider: string | undefined): boolean;
export declare function isManagedZaiProvider(provider: string | undefined): boolean;
/** True when the active model uses Pi's built-in Z.AI providers (not platform). */
export declare function isNativeZaiModel(model: ZaiModel | undefined): boolean;
export declare function isManagedZaiModel(model: ZaiModel | undefined): boolean;
export declare function isZaiPlatformModel(model: ZaiModel | undefined): boolean;
//# sourceMappingURL=native-zai.d.ts.map