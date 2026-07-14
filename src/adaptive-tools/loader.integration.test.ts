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
import type { ZaiModel } from "../zai-model.ts";

const temporaryDirectories: string[] = [];

afterEach(() => {
	for (const directory of temporaryDirectories.splice(0)) {
		rmSync(directory, { recursive: true, force: true });
	}
});

function tempCwd(mode = "manual"): string {
	const directory = mkdtempSync(join(tmpdir(), "pi-zai-adaptive-"));
	temporaryDirectories.push(directory);
	mkdirSync(join(directory, CONFIG_DIR_NAME), { recursive: true });
	writeFileSync(
		join(directory, CONFIG_DIR_NAME, "settings.json"),
		JSON.stringify({
			zai: {
				adaptiveTools: {
					mode,
					alwaysActive: ["read", "grep", "find", "ls", "zai_load_tools"],
					groups: { shell: ["bash"] },
				},
				metrics: { mode: "memory" },
			},
		}),
	);
	return directory;
}

function nonZaiModel(): ZaiModel {
	return { ...createZaiModel(), provider: "openai" };
}

describe("adaptive loader integration", () => {
	it("loads a configured group and rotates the next cache segment once", async () => {
		const cwd = tempCwd();
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

		await pi.executeTool("zai_load_tools", { group: "shell" });
		expect(pi.getActiveTools()).toContain("bash");
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
		expect(secondFingerprint).not.toBe(firstFingerprint);
		expect(sessionState.lastToolsetTransition?.classification).toBe(
			"tools-added",
		);
		const generation = sessionState.toolsetGeneration;
		await pi.trigger(
			"before_provider_request",
			{
				type: "before_provider_request",
				payload: { thinking: { type: "enabled", clear_thinking: false } },
			},
			ctx,
		);
		expect(sessionState.toolsetGeneration).toBe(generation);
	});

	it("keeps every ungrouped tool active instead of applying a silent cap", async () => {
		const cwd = tempCwd();
		const pi = createMockExtensionApi({ cwd, model: createZaiModel() });
		const ungrouped = Array.from(
			{ length: 20 },
			(_, index) => `foreign-${index}`,
		);
		pi.setActiveTools([...pi.getActiveTools(), ...ungrouped]);
		piZaiExtension(pi);
		await pi.trigger(
			"session_start",
			{ type: "session_start", reason: "startup" },
			createExtensionContext(cwd),
		);
		for (const name of ungrouped) expect(pi.getActiveTools()).toContain(name);
	});

	it("applies on Z.AI model selection and restores controlled tools when leaving", async () => {
		const cwd = tempCwd();
		const initial = nonZaiModel();
		const pi = createMockExtensionApi({ cwd, model: initial });
		piZaiExtension(pi);
		const ctx = createExtensionContext(cwd, initial);
		await pi.trigger(
			"session_start",
			{ type: "session_start", reason: "startup" },
			ctx,
		);
		expect(pi.getActiveTools()).toContain("bash");

		await pi.trigger(
			"model_select",
			{
				type: "model_select",
				model: createZaiModel(),
				previousModel: initial,
				source: "set",
			},
			ctx,
		);
		expect(pi.getActiveTools()).not.toContain("bash");
		expect(pi.getActiveTools()).toContain("zai_load_tools");

		await pi.trigger(
			"model_select",
			{
				type: "model_select",
				model: initial,
				previousModel: createZaiModel(),
				source: "set",
			},
			ctx,
		);
		expect(pi.getActiveTools()).toContain("bash");
		expect(pi.getActiveTools()).not.toContain("zai_load_tools");
	});

	it("records useful observations without changing tools", async () => {
		const cwd = tempCwd("observe");
		const pi = createMockExtensionApi({ cwd, model: createZaiModel() });
		const before = [...pi.getActiveTools()];
		piZaiExtension(pi);
		await pi.trigger(
			"session_start",
			{ type: "session_start", reason: "startup" },
			createExtensionContext(cwd),
		);
		expect(pi.getActiveTools()).toEqual(before);
		expect(sessionState.adaptiveTools?.observation).toMatchObject({
			deferredCount: 1,
			configuredGroupCount: 1,
		});
	});
});
