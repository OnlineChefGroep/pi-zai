import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import piZaiExtension from "./index.ts";
import { EXTENSION_VERSION } from "./version.generated.ts";

const EXTENSION_USER_AGENT = `pi-zai/${EXTENSION_VERSION}`;
const EXTENSION_ACCEPT_LANGUAGE = "en-US,en";

/**
 * Canonical Pi entrypoint.
 *
 * index.ts retains the public integration surface. This entrypoint adds a final
 * request-boundary guard that removes only headers injected by older pi-zai
 * behavior. User-supplied or Pi-native header values are never removed.
 *
 * This keeps observe/default mode wire-compatible with native Pi and avoids
 * exposing a pi-zai client fingerprint to providers that may route or throttle
 * by User-Agent. Experimental X-Session-Id affinity remains opt-in.
 */
export default function piZaiExtensionWithNativeIdentity(pi: ExtensionAPI): void {
	piZaiExtension(pi);

	pi.on("before_provider_headers", async (event) => {
		for (const key of Object.keys(event.headers)) {
			const normalized = key.toLowerCase();
			const value = event.headers[key];
			if (normalized === "user-agent" && value === EXTENSION_USER_AGENT) {
				delete event.headers[key];
			}
			if (
				normalized === "accept-language" &&
				value === EXTENSION_ACCEPT_LANGUAGE
			) {
				delete event.headers[key];
			}
		}
	});
}
