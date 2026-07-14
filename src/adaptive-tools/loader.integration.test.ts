import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CONFIG_DIR_NAME } from "@earendil-works/pi-coding-agent";
import { afterEach, describe, expect, it } from "vitest";
import {
	createExtensionContext,
	createMockExtensionApi,
	createZaiModel,
} from "../../test/mock-extension-api.ts";
import piZaiExtension from "../index.ts";
import { getCacheMetricsStore, sessionState } from "../state.ts";

const temporaryDirectories: string[] = [];

afterEach(() => {
	for (const directory of temporaryDirectories.splice(0)) {
		rmSync(directory, { recursive: true, force: true });
	}
});

function tempCwd(): string {
	const directory = mkdtempSync(join(tmpdir(), "pi-zai-adaptive-"));
	temporaryDirectories.push(directory);
	return directory;
}

describe("adaptive loader integration", () => {
	it("rotates the cache segment when tools are activated between provider requests", async () => {
		const cwd = tempCwd();
		mkdirSync(join(cwd, CONFIG_DIR_NAME), { recursive: true });
		writeFileSync(
			join(cwd, CONFIG_DIR_NAME, "settings.json"),
			JSON.stringify({
				zai: {
					adaptiveTools: {
						mode: "manual",
						alwaysActive: ["read", "grep", "find", "ls", "zai_load_tools"],
						groups: { shell: ["bash"] },
					},
					metrics: { mode: "memory" },
				},
			}),
		);

		const pi = createMockExtensionApi({ cwd, model: createZaiModel() });
		piZaiExtension(pi);
		const ctx = createExtensionContext(cwd);

		await pi.trigger(
			"session_start",
			{ type: "session_start", reason: "startup" },
			ctx,
		);

		expect(pi.getActiveTools()).toContain("zai_load_tools");
		expect(pi.getActiveTools()).not.toContain("bash");

		await pi.trigger(
			"before_agent_start",
			{ type: "before_agent_start", systemPrompt: "stable system prompt" },
			ctx,
		);
		await pi.trigger(
			"before_provider_request",
			{
				type: "before_provider_request",
				payload: { thinking: { type: "enabled", clear_thinking: false } },
			},
			ctx,
		);

		const firstFingerprint =
			getCacheMetricsStore().get()?.segment.toolsetFingerprint;
		expect(firstFingerprint).toBeTruthy();

		pi.setActiveTools([...pi.getActiveTools(), "bash"]);

		await pi.trigger(
			"before_provider_request",
			{
				type: "before_provider_request",
				payload: { thinking: { type: "enabled", clear_thinking: false } },
			},
			ctx,
		);

		const secondFingerprint =
			getCacheMetricsStore().get()?.segment.toolsetFingerprint;
		expect(secondFingerprint).toBeTruthy();
		expect(secondFingerprint).not.toBe(firstFingerprint);
		expect(sessionState.lastToolsetTransition?.classification).toBe(
			"tools-added",
		);
		expect(sessionState.toolsetGeneration).toBeGreaterThan(0);
	});

	it("leaves tools unchanged in observe mode", async () => {
		const cwd = tempCwd();
		mkdirSync(join(cwd, CONFIG_DIR_NAME), { recursive: true });
		writeFileSync(
			join(cwd, CONFIG_DIR_NAME, "settings.json"),
			JSON.stringify({
				zai: {
					adaptiveTools: {
						mode: "observe",
						groups: { shell: ["bash"] },
					},
					metrics: { mode: "memory" },
				},
			}),
		);

		const pi = createMockExtensionApi({ cwd, model: createZaiModel() });
		const before = [...pi.getActiveTools()].sort();
		piZaiExtension(pi);
		const ctx = createExtensionContext(cwd);
		await pi.trigger(
			"session_start",
			{ type: "session_start", reason: "startup" },
			ctx,
		);
		expect([...pi.getActiveTools()].sort()).toEqual(before);
		expect(pi.getActiveTools()).not.toContain("zai_load_tools");
	});
});
