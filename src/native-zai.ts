import { isZaiModel } from "./cache/context-policy.ts";
import type { ZaiModel } from "./zai-model.ts";

/** True when the active model uses Pi's native Z.AI providers. */
export function isNativeZaiModel(model: ZaiModel | undefined): boolean {
	return isZaiModel(model);
}
