import { describe, expect, it } from "vitest";
import {
	EMPTY_TRANSPORT_SUMMARY,
	EMPTY_USAGE_SUMMARY,
} from "../storage/types.ts";
import {
	buildBenchmarkRunReport,
	evaluateRunGates,
	formatBenchmarkGatesSummary,
	formatBenchmarkRunReport,
} from "./report.ts";
import type { BenchmarkRunManifest } from "./types.ts";

const manifest: BenchmarkRunManifest = {
	schema: 1,
	runId: "bench-test",
	createdAt: 1_000,
	variant: "A1",
	scenario: "stable-conversation",
	extensionVersion: "0.1.1",
	projectId: "project-a",
	attemptsBaseline: 0,
	settings: {},
};

describe("buildBenchmarkRunReport", () => {
	it("builds report with gate checks", () => {
		const report = buildBenchmarkRunReport({
			manifest,
			completedAt: 5_000,
			usage: { ...EMPTY_USAGE_SUMMARY, attempts: 12, cacheHitRatio: 0.8 },
			transport: { ...EMPTY_TRANSPORT_SUMMARY, attempts: 12 },
			cache: undefined,
			completedRunsForVariant: 3,
			turnsObserved: 12,
		});

		expect(report.turnsObserved).toBe(12);
		expect(report.durationMs).toBe(4_000);
		expect(
			report.gates.find((gate) => gate.id === "turns-per-session")?.passed,
		).toBe(true);
		expect(
			report.gates.find((gate) => gate.id === "sessions-per-variant")?.passed,
		).toBe(false);
	});

	it("uses persisted run-window usage instead of a pre-existing cache segment", () => {
		const report = buildBenchmarkRunReport({
			manifest,
			completedAt: 5_000,
			usage: { ...EMPTY_USAGE_SUMMARY, attempts: 2, cacheHitRatio: 0.25 },
			transport: EMPTY_TRANSPORT_SUMMARY,
			cache: {
				segment: {
					provider: "zai",
					endpoint: "coding",
					model: "glm-5.2",
					systemFingerprint: "system",
					toolsetFingerprint: "tools",
				},
				last: undefined,
				rolling: {
					input: 0,
					cacheRead: 1_000,
					cacheWrite: 0,
					output: 0,
					requests: 99,
					hitRatio: 1,
					estimatedCost: 0,
					estimatedSavings: 0,
				},
				segmentStartedAt: 0,
			},
			completedRunsForVariant: 1,
			turnsObserved: 2,
		});
		expect(report.cache).toMatchObject({
			requestsInSegment: 2,
			cacheHitRatio: 0.25,
			segmentChanges: 0,
		});
	});

});

describe("evaluateRunGates", () => {
	it("fails when turns are below threshold", () => {
		const gates = evaluateRunGates("A2", "stable-conversation", 3, 1);
		expect(gates[0]?.passed).toBe(false);
	});

	it("uses scenario-specific turn targets", () => {
		const gates = evaluateRunGates("A1", "controlled-failure", 8, 5);
		expect(gates[0]).toMatchObject({ required: 8, actual: 8, passed: true });
	});
});

describe("formatBenchmarkGatesSummary", () => {
	it("summarizes completed runs", () => {
		const text = formatBenchmarkGatesSummary([
			{
				variant: "A1",
				scenario: "stable-conversation",
				report: buildBenchmarkRunReport({
					manifest: { ...manifest, variant: "A1" },
					completedAt: 2_000,
					usage: { ...EMPTY_USAGE_SUMMARY, attempts: 12, cacheHitRatio: 0.5 },
					transport: EMPTY_TRANSPORT_SUMMARY,
					cache: undefined,
					completedRunsForVariant: 1,
					turnsObserved: 12,
				}),
			},
		]);
		expect(text).toContain("Completed runs by variant/scenario");
		expect(text).toContain("A1/stable-conversation: 1");
	});
});

describe("formatBenchmarkRunReport", () => {
	it("formats completed run details", () => {
		const text = formatBenchmarkRunReport({
			runId: manifest.runId,
			createdAt: manifest.createdAt,
			variant: manifest.variant,
			scenario: manifest.scenario,
			manifest,
			report: buildBenchmarkRunReport({
				manifest,
				completedAt: 5_000,
				usage: { ...EMPTY_USAGE_SUMMARY, attempts: 1, cacheHitRatio: 0.75 },
				transport: { ...EMPTY_TRANSPORT_SUMMARY, errors: 0 },
				cache: undefined,
				completedRunsForVariant: 1,
				turnsObserved: 1,
			}),
		});
		expect(text).toContain("Turns observed: 1");
		expect(text).toContain("Cache hit ratio: 75.0%");
	});
});
