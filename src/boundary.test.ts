/**
 * Runtime boundary tests — mock-only, no LLM or API cost.
 *
 * These tests load the extension against a fake ExtensionAPI and spy on global
 * fetch. They never start a real Pi session, never call a model, and never hit
 * the network unless a test explicitly exercises telemetry upload.
 *
 * runExtensionLifecycle() fires the pi.on() handlers from index.ts in-process
 * (including tool_execution_start/end) to prove a typical session path stays
 * local when telemetry is off.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CONFIG_DIR_NAME } from "@earendil-works/pi-coding-agent";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	createExtensionContext,
	createMockExtensionApi,
	createZaiCodingCnModel,
	createZaiModel,
	runExtensionLifecycle,
} from "../test/mock-extension-api.ts";
import { loadZaiConfig } from "./config.ts";
import piZaiExtension from "./index.ts";
import {
	buildAggregateTelemetryPreview,
	formatPrivacyPreview,
} from "./privacy-preview.ts";
import { snapshotPromptStability } from "./prompt-stability.ts";
import { EMPTY_USAGE_SUMMARY } from "./storage/types.ts";
import {
	clearTelemetryConsent,
	writeTelemetryConsent,
} from "./telemetry/consent.ts";
import type { AggregateTelemetryPayload } from "./telemetry/types.ts";
import { uploadAggregatePayload } from "./telemetry/uploader.ts";

const temporaryDirectories: string[] = [];
const EXPECTED_COMMANDS = [
	"zai",
	"zai-endpoint",
	"zai-cache",
	"zai-data",
	"zai-usage",
	"zai-doctor",
	"zai-capabilities",
	"zai-privacy",
	"zai-transport",
	"zai-benchmark",
	"zai-telemetry",
] as const;

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

describe("extension boundary (runtime)", () => {
	let fetchSpy: ReturnType<typeof vi.spyOn>;

	beforeEach(() => {
		clearTelemetryConsent();
		fetchSpy = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(
				new Response(JSON.stringify({ ok: true }), { status: 202 }),
			);
	});

	afterEach(() => {
		clearTelemetryConsent();
		fetchSpy.mockRestore();
	});

	it("loads the extension module and registers hooks without touching Pi providers", async () => {
		const module = await import("./index.ts");
		const pi = createMockExtensionApi({ cwd: tempCwd() });
		module.default(pi);

		expect(typeof module.default).toBe("function");
		expect(pi.providerCalls.register).toEqual([]);
		expect(pi.providerCalls.unregister).toEqual([]);
		expect(pi.commandCalls.map((command) => command.name).sort()).toEqual(
			[...EXPECTED_COMMANDS].sort(),
		);
	});

	it("does not call fetch across the full extension lifecycle when telemetry is off", async () => {
		const cwd = tempCwd();
		const pi = createMockExtensionApi({ cwd, model: createZaiModel() });
		piZaiExtension(pi);
		const ctx = createExtensionContext(cwd);

		await runExtensionLifecycle(pi, ctx, { safePromptMode: true });

		expect(fetchSpy).not.toHaveBeenCalled();
		expect(pi.providerCalls.register).toEqual([]);
		expect(pi.providerCalls.unregister).toEqual([]);
	});

	it("treats China Coding Plan (zai-coding-cn) as native without provider overrides", async () => {
		const cwd = tempCwd();
		const model = createZaiCodingCnModel();
		expect(model.baseUrl).toBe("https://open.bigmodel.cn/api/coding/paas/v4");
		const pi = createMockExtensionApi({ cwd, model });
		piZaiExtension(pi);
		const ctx = createExtensionContext(cwd, model);

		await runExtensionLifecycle(pi, ctx);

		expect(fetchSpy).not.toHaveBeenCalled();
		expect(pi.providerCalls.register).toEqual([]);
		expect(pi.providerCalls.unregister).toEqual([]);
	});

	it("does not read PI_ZAI_* environment overrides at runtime", () => {
		const cwd = tempCwd();
		const previous = {
			mode: process.env.PI_ZAI_TELEMETRY_MODE,
			url: process.env.PI_ZAI_TELEMETRY_INGEST_URL,
			metrics: process.env.PI_ZAI_METRICS_MODE,
		};

		process.env.PI_ZAI_TELEMETRY_MODE = "aggregate";
		process.env.PI_ZAI_TELEMETRY_INGEST_URL = "https://evil.example/telemetry";
		process.env.PI_ZAI_METRICS_MODE = "off";

		try {
			const config = loadZaiConfig(cwd);
			expect(config.telemetryMode).toBe("off");
			expect(config.telemetryIngestUrl).toBeUndefined();
			expect(config.metrics.mode).toBe("local");
		} finally {
			if (previous.mode === undefined) delete process.env.PI_ZAI_TELEMETRY_MODE;
			else process.env.PI_ZAI_TELEMETRY_MODE = previous.mode;
			if (previous.url === undefined)
				delete process.env.PI_ZAI_TELEMETRY_INGEST_URL;
			else process.env.PI_ZAI_TELEMETRY_INGEST_URL = previous.url;
			if (previous.metrics === undefined)
				delete process.env.PI_ZAI_METRICS_MODE;
			else process.env.PI_ZAI_METRICS_MODE = previous.metrics;
		}
	});

	it("supports aggregate telemetry mode from project settings without network side effects in preview", () => {
		const cwd = tempCwd();
		writeProjectSettings(cwd, { zai: { telemetry: { mode: "aggregate" } } });
		const config = loadZaiConfig(cwd);

		expect(config.telemetryMode).toBe("aggregate");

		const preview = buildAggregateTelemetryPreview(
			config,
			"0.5.0",
			{
				provider: "zai",
				modelId: "glm-5.2",
				endpoint: "coding",
				promptStability: snapshotPromptStability("rules"),
			},
			{ ...EMPTY_USAGE_SUMMARY, attempts: 3 },
		);
		const text = formatPrivacyPreview(
			config,
			"0.5.0",
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

		expect(preview.status).toBe("preview-only-not-sent");
		expect(text).toContain("mode: aggregate");
		expect(text).toContain("uploads: disabled");
		expect(fetchSpy).not.toHaveBeenCalled();
	});

	it("leaves Pi native thinking payload unchanged by default", async () => {
		const cwd = tempCwd();
		const pi = createMockExtensionApi({ cwd, model: createZaiModel() });
		piZaiExtension(pi);
		const ctx = createExtensionContext(cwd);

		await pi.trigger(
			"session_start",
			{ type: "session_start", reason: "startup" },
			ctx,
		);
		const [result] = await pi.trigger(
			"before_provider_request",
			{
				type: "before_provider_request",
				payload: { thinking: { type: "enabled", clear_thinking: false } },
			},
			ctx,
		);

		expect(result).toBeUndefined();
	});

	it("applies an explicit preserveThinking=false override at runtime", async () => {
		const cwd = tempCwd();
		writeProjectSettings(cwd, { zai: { preserveThinking: false } });
		const pi = createMockExtensionApi({ cwd, model: createZaiModel() });
		piZaiExtension(pi);
		const ctx = createExtensionContext(cwd);

		await pi.trigger(
			"session_start",
			{ type: "session_start", reason: "startup" },
			ctx,
		);
		const [result] = await pi.trigger(
			"before_provider_request",
			{
				type: "before_provider_request",
				payload: { thinking: { type: "enabled", clear_thinking: false } },
			},
			ctx,
		);

		expect(result).toEqual({
			thinking: { type: "enabled", clear_thinking: true },
		});
	});

	it("calls fetch only through the telemetry uploader for aggregate uploads", async () => {
		const payload: AggregateTelemetryPayload = {
			schema: 1,
			day: "2026-07-12",
			extensionVersion: "0.5.0",
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
			byProviderModel: [
				{
					provider: "zai",
					model: "glm-5.2",
					endpointKind: "coding",
					attempts: 1,
					errors: 0,
				},
			],
			errorCategories: {},
		};

		await uploadAggregatePayload(payload, "https://example.test/telemetry");

		expect(fetchSpy).toHaveBeenCalledTimes(1);
		expect(fetchSpy.mock.calls[0]?.[0]).toBe("https://example.test/telemetry");
		expect(
			String(fetchSpy.mock.calls[0]?.[1]?.headers?.["User-Agent"] ?? ""),
		).toContain("pi-zai-telemetry");
	});

	it("calls fetch on session_start only when aggregate telemetry is enabled and consented", async () => {
		const cwd = tempCwd();
		writeProjectSettings(cwd, {
			zai: {
				telemetry: {
					mode: "aggregate",
					ingestUrl: "https://example.test/telemetry",
				},
				metrics: { mode: "memory" },
			},
		});
		writeTelemetryConsent();
		const pi = createMockExtensionApi({ cwd, model: createZaiModel() });
		piZaiExtension(pi);
		const ctx = createExtensionContext(cwd);

		await pi.trigger(
			"session_start",
			{ type: "session_start", reason: "startup" },
			ctx,
		);

		expect(fetchSpy).not.toHaveBeenCalled();
	});
});
