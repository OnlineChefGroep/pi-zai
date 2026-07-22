import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CONFIG_DIR_NAME } from "@earendil-works/pi-coding-agent";
import { afterEach, describe, expect, it } from "vitest";
import {
	createExtensionContext,
	createMockExtensionApi,
	createZaiModel,
} from "../test/mock-extension-api.ts";
import piZaiExtension from "./extension.ts";

const temporaryDirectories: string[] = [];

afterEach(() => {
	for (const directory of temporaryDirectories.splice(0)) {
		rmSync(directory, { recursive: true, force: true });
	}
});

function tempCwd(): string {
	const directory = mkdtempSync(join(tmpdir(), "pi-zai-identity-"));
	temporaryDirectories.push(directory);
	return directory;
}

function writeProjectSettings(
	cwd: string,
	settings: Record<string, unknown>,
): void {
	const directory = join(cwd, CONFIG_DIR_NAME);
	mkdirSync(directory, { recursive: true });
	writeFileSync(
		join(directory, "settings.json"),
		`${JSON.stringify(settings, null, 2)}\n`,
		"utf-8",
	);
}

async function startSession(cwd: string) {
	const model = createZaiModel();
	const pi = createMockExtensionApi({ cwd, model });
	piZaiExtension(pi);
	const ctx = createExtensionContext(cwd, model);
	await pi.trigger(
		"session_start",
		{ type: "session_start", reason: "startup" },
		ctx,
	);
	return { pi, ctx };
}

describe("native request identity guard", () => {
	it("removes only pi-zai injected identity headers by default", async () => {
		const cwd = tempCwd();
		const { pi, ctx } = await startSession(cwd);
		const event = {
			type: "before_provider_headers" as const,
			headers: {} as Record<string, string>,
		};

		await pi.trigger("before_provider_headers", event, ctx);

		expect(event.headers).toEqual({});
	});

	it("preserves caller-supplied identity headers", async () => {
		const cwd = tempCwd();
		const { pi, ctx } = await startSession(cwd);
		const event = {
			type: "before_provider_headers" as const,
			headers: {
				"User-Agent": "pi-native/test",
				"Accept-Language": "nl-NL,nl",
			},
		};

		await pi.trigger("before_provider_headers", event, ctx);

		expect(event.headers).toEqual({
			"User-Agent": "pi-native/test",
			"Accept-Language": "nl-NL,nl",
		});
	});

	it("keeps experimental affinity opt-in while removing identity headers", async () => {
		const cwd = tempCwd();
		writeProjectSettings(cwd, {
			zai: { sessionAffinity: "experimental" },
		});
		const { pi, ctx } = await startSession(cwd);
		const event = {
			type: "before_provider_headers" as const,
			headers: {} as Record<string, string>,
		};

		await pi.trigger("before_provider_headers", event, ctx);

		expect(event.headers["X-Session-Id"]).toBeTypeOf("string");
		expect(event.headers["User-Agent"]).toBeUndefined();
		expect(event.headers["Accept-Language"]).toBeUndefined();
	});
});
