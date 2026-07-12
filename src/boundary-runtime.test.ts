import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadZaiConfig } from "./config.ts";
import piZaiExtension from "./index.ts";
import { buildAggregateTelemetryPreview, formatPrivacyPreview } from "./privacy-preview.ts";
import { snapshotPromptStability } from "./prompt-stability.ts";
import { EMPTY_USAGE_SUMMARY } from "./storage/types.ts";
import { createMockExtensionApi, createZaiModel } from "../test/mock-extension-api.ts";
import type { AggregateTelemetryPayload } from "./telemetry/types.ts";
import { uploadAggregatePayload } from "./telemetry/uploader.ts";

const temporaryDirectories: string[] = [];

afterEach(() => {
	for (const directory of temporaryDirectories.splice(0)) {
		rmSync(directory, { recursive: true, force: true });
	}
});

function tempCwd(): string {
	const directory = mkdtempSync(join(tmpdir(), "pi-zai-boundary-"));
	temporaryDirectories.push(directory);
	return directory;
}

describe("runtime extension boundary", () => {
	let fetchSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
			new Response(JSON.stringify({ ok: true }), { status: 202 }),
		);
	});

	afterEach(() => {
		fetchSpy.mockRestore();
	});

	it("does not register or unregister Pi native providers at load time", () => {
		const pi = createMockExtensionApi({ cwd: tempCwd() });
		piZaiExtension(pi);
		expect(pi.providerCalls.register).toEqual([]);
		expect(pi.providerCalls.unregister).toEqual([]);
	});

	it("does not call fetch during a typical extension lifecycle with telemetry off", async () => {
		const cwd = tempCwd();
		const pi = createMockExtensionApi({ cwd, model: createZaiModel() });
		piZaiExtension(pi);

		const ctx = {
			ui: { notify: () => {} },
			cwd,
			model: createZaiModel(),
			sessionManager: { getSessionId: () => "session-1", getBranch: () => [] },
			modelRegistry: {
				getApiKey: () => undefined,
				getProviderAuthStatus: () => ({ configured: false }),
			},
		} as Parameters<typeof pi.trigger>[2];

		await pi.trigger("session_start", { type: "session_start", reason: "startup" }, ctx);
		await pi.trigger("model_select", { type: "model_select", model: createZaiModel() }, ctx);
		await pi.trigger(
			"before_agent_start",
			{ type: "before_agent_start", systemPrompt: "rules\n\n--- dynamic context ---\nctx" },
			ctx,
		);
		await pi.trigger(
			"turn_end",
			{
				type: "turn_end",
				message: {
					role: "assistant",
					usage: {
						input: 10,
						output: 5,
						cacheRead: 90,
						cacheWrite: 0,
						cost: { total: 0 },
					},
				},
			},
			ctx,
		);
		await pi.trigger("session_shutdown", { type: "session_shutdown" }, ctx);

		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("does not call fetch from privacy preview helpers", () => {
		const config = loadZaiConfig(tempCwd());
		buildAggregateTelemetryPreview(
			config,
			"0.3.0",
			{
				provider: "zai",
				modelId: "glm-5.2",
				endpoint: "coding",
				promptStability: snapshotPromptStability("rules"),
			},
			{ ...EMPTY_USAGE_SUMMARY, attempts: 3 },
		);
		formatPrivacyPreview(
			config,
			"0.3.0",
			{
				projectId: "local-only",
				sessionHash: "local-only",
				provider: "zai",
				modelId: "glm-5.2",
				endpoint: "coding",
				promptStability: undefined,
			},
			EMPTY_USAGE_SUMMARY,
		);
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("calls fetch only through the telemetry uploader for aggregate uploads", async () => {
		const payload: AggregateTelemetryPayload = {
			schema: 1,
			day: "2026-07-12",
			extensionVersion: "0.3.0",
			promptMode: "observe",
			attempts: 1,
			errors: 0,
			inputTokens: 10,
			cacheReadTokens: 0,
			cacheWriteTokens: 0,
			outputTokens: 5,
			turnBucket: "0-5",
			cacheRatioBucket: "0-25",
			retryRateBucket: "0-2",
			byProviderModel: [{ provider: "zai", model: "glm-5.2", endpointKind: "coding", attempts: 1, errors: 0 }],
			errorCategories: {},
		};

		await uploadAggregatePayload(payload, "https://example.test/telemetry");

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		expect(fetchSpy.mock.calls[0]?.[0]).toBe("https://example.test/telemetry");
	});
});
