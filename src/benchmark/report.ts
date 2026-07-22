import type { SessionCacheStats } from "../cache/metrics.ts";
import type { TransportSummary, UsageSummary } from "../storage/types.ts";
import {
	BENCHMARK_SAMPLE_GATES,
	type BenchmarkScenarioId,
	type BenchmarkVariantId,
	findBenchmarkScenario,
} from "./manifest.ts";
import type {
	BenchmarkGateCheck,
	BenchmarkRunManifest,
	BenchmarkRunRecord,
	BenchmarkRunReport,
} from "./types.ts";

export type BenchmarkReportInput = {
	manifest: BenchmarkRunManifest;
	completedAt: number;
	usage: UsageSummary;
	transport: TransportSummary;
	cache: SessionCacheStats | undefined;
	completedRunsForVariant: number;
	turnsObserved: number;
};

export function buildBenchmarkRunReport(
	input: BenchmarkReportInput,
): BenchmarkRunReport {
	const cacheHitRatio = input.usage.cacheHitRatio;

	return {
		schema: 1,
		completedAt: input.completedAt,
		durationMs: Math.max(0, input.completedAt - input.manifest.createdAt),
		turnsObserved: input.turnsObserved,
		usage: input.usage,
		transport: input.transport,
		cache: {
			requestsInSegment: input.usage.attempts,
			cacheHitRatio,
			segmentChanges: 0,
		},
		gates: evaluateRunGates(
			input.manifest.variant,
			input.manifest.scenario,
			input.turnsObserved,
			input.completedRunsForVariant,
		),
	};
}

export function evaluateRunGates(
	variant: BenchmarkVariantId,
	scenario: BenchmarkScenarioId,
	turnsObserved: number,
	completedRunsForVariant: number,
): BenchmarkGateCheck[] {
	const requiredTurns =
		findBenchmarkScenario(scenario)?.turns ??
		BENCHMARK_SAMPLE_GATES.turnsPerSession;
	return [
		{
			id: "turns-per-session",
			label: "Turns in this session",
			required: requiredTurns,
			actual: turnsObserved,
			passed: turnsObserved >= requiredTurns,
		},
		{
			id: "sessions-per-variant",
			label: `Completed runs for ${variant}/${scenario}`,
			required: BENCHMARK_SAMPLE_GATES.sessionsPerVariantScenario,
			actual: completedRunsForVariant,
			passed:
				completedRunsForVariant >=
				BENCHMARK_SAMPLE_GATES.sessionsPerVariantScenario,
		},
	];
}

export function formatBenchmarkRunReport(record: BenchmarkRunRecord): string {
	if (!record.report) {
		return `Benchmark run ${record.runId} (${record.variant}/${record.scenario}) is still in progress.`;
	}

	const report = record.report;
	const gateLines = report.gates.map((gate) => {
		const status = gate.passed ? "pass" : "fail";
		return `  ${gate.label}: ${gate.actual}/${gate.required} (${status})`;
	});

	return [
		`Benchmark report: ${record.variant} / ${record.scenario}`,
		`  Run id: ${record.runId}`,
		`  Duration: ${Math.round(report.durationMs / 1000)}s`,
		`  Turns observed: ${report.turnsObserved}`,
		`  Cache hit ratio: ${(report.cache.cacheHitRatio * 100).toFixed(1)}%`,
		`  Terminal transport errors: ${report.transport.errors}`,
		"  Sample gates:",
		...gateLines,
	].join("\n");
}

export function formatBenchmarkGatesSummary(
	runs: readonly {
		variant: BenchmarkVariantId;
		scenario: BenchmarkScenarioId;
		report?: BenchmarkRunReport;
	}[],
): string {
	const completed = runs.filter((run) => run.report !== undefined);
	if (completed.length === 0) {
		return "No completed benchmark runs yet. Use /zai-benchmark start then complete after your scenario.";
	}

	const byVariantScenario = new Map<string, number>();
	for (const run of completed) {
		const key = `${run.variant}/${run.scenario}`;
		byVariantScenario.set(key, (byVariantScenario.get(key) ?? 0) + 1);
	}

	const lines = [
		"pi-zai benchmark gate summary",
		"",
		"Completed runs by variant/scenario:",
		...Array.from(byVariantScenario.entries()).map(
			([key, count]) => `  ${key}: ${count}`,
		),
		"",
		"Automated A1-A3 targets:",
		`  ${BENCHMARK_SAMPLE_GATES.sessionsPerVariantScenario} sessions per variant/scenario`,
		`  ${BENCHMARK_SAMPLE_GATES.minTotalTurnsA1A3}+ total turns across A1-A3 before default changes`,
		`  ${Math.round(BENCHMARK_SAMPLE_GATES.minRelativeMissReductionForAffinity * 100)}% relative miss-rate reduction for affinity`,
		"  A0 remains an external native-Pi control for extension-overhead claims",
	];

	const median = (values: number[]): number => {
		const sorted = [...values].sort((left, right) => left - right);
		if (sorted.length === 0) return 0;
		const middle = Math.floor(sorted.length / 2);
		if (sorted.length % 2 === 1) return sorted[middle] ?? 0;
		return ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
	};
	const cacheHitRatios = (runs: typeof completed): number[] =>
		runs.flatMap((run) => (run.report ? [run.report.cache.cacheHitRatio] : []));
	const scenarios = new Set(completed.map((run) => run.scenario));
	for (const scenario of scenarios) {
		const affinityRuns = completed.filter(
			(run) => run.variant === "A3" && run.scenario === scenario,
		);
		const baselineRuns = completed.filter(
			(run) => run.variant === "A1" && run.scenario === scenario,
		);
		if (affinityRuns.length === 0 || baselineRuns.length === 0) continue;
		const a3Median = median(cacheHitRatios(affinityRuns));
		const a1Median = median(cacheHitRatios(baselineRuns));
		const absoluteGapPp = (a3Median - a1Median) * 100;
		const a1Miss = Math.max(0, 1 - a1Median);
		const a3Miss = Math.max(0, 1 - a3Median);
		const relativeMissReduction =
			a1Miss > 0 ? (a1Miss - a3Miss) / a1Miss : 0;
		const passed =
			relativeMissReduction >=
			BENCHMARK_SAMPLE_GATES.minRelativeMissReductionForAffinity;
		lines.push(
			"",
			`A3 vs A1 (${scenario}): ${absoluteGapPp.toFixed(2)}pp hit-rate gap; ${(relativeMissReduction * 100).toFixed(1)}% relative miss reduction (${passed ? "pass" : "fail"})`,
		);
	}

	return lines.join("\n");
}
