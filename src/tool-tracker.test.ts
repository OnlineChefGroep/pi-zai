import { describe, expect, it } from "vitest";
import {
	formatToolSessionLines,
	ToolExecutionTracker,
} from "./tool-tracker.ts";

describe("ToolExecutionTracker", () => {
	it("tracks counts, errors, and durations by tool name", () => {
		const tracker = new ToolExecutionTracker();
		tracker.begin("call-1", "read", "q-1", 1000);
		tracker.complete("call-1", "read", false, 1250);
		tracker.begin("call-2", "bash", "q-1", 1300);
		tracker.complete("call-2", "bash", true, 1600);
		tracker.begin("call-3", "read", "q-2", 1700);
		tracker.complete("call-3", "read", false, 1800);

		const stats = tracker.get();
		expect(stats.executions).toBe(3);
		expect(stats.errors).toBe(1);
		expect(stats.avgMs).toBe(217);
		expect(stats.byTool).toEqual([
			{ toolName: "read", count: 2, errors: 0, totalMs: 350, avgMs: 175 },
			{ toolName: "bash", count: 1, errors: 1, totalMs: 300, avgMs: 300 },
		]);
		expect(stats.turn).toEqual({
			executions: 3,
			errors: 1,
			totalMs: 650,
		});
		expect(stats.last).toMatchObject({
			toolName: "read",
			durationMs: 100,
			isError: false,
			queryId: "q-2",
		});
	});

	it("resets turn counters independently of session totals", () => {
		const tracker = new ToolExecutionTracker();
		tracker.begin("call-1", "read", "q-1", 0);
		tracker.complete("call-1", "read", false, 50);
		tracker.beginTurn();
		expect(tracker.getTurnStats()).toEqual({
			executions: 0,
			errors: 0,
			totalMs: 0,
		});
		expect(tracker.get().executions).toBe(1);
	});

	it("formats an empty session clearly", () => {
		expect(formatToolSessionLines(new ToolExecutionTracker().get())).toEqual([
			"  none yet",
		]);
	});

	it("formats session tool stats for command output", () => {
		const tracker = new ToolExecutionTracker();
		tracker.begin("call-1", "read", "q-1", 0);
		tracker.complete("call-1", "read", false, 100);
		const lines = formatToolSessionLines(tracker.get());
		expect(lines[0]).toContain("Executions: 1");
		expect(lines.some((line) => line.includes("By tool: read 1"))).toBe(true);
	});
});
