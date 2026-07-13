export type ToolExecutionSample = {
	toolName: string;
	durationMs: number;
	isError: boolean;
	timestamp: number;
	queryId: string | undefined;
};

export type ToolNameStats = {
	toolName: string;
	count: number;
	errors: number;
	totalMs: number;
	avgMs: number;
};

export type ToolTurnStats = {
	executions: number;
	errors: number;
	totalMs: number;
};

export type ToolSessionStats = {
	executions: number;
	errors: number;
	totalMs: number;
	avgMs: number;
	byTool: ToolNameStats[];
	last: ToolExecutionSample | undefined;
	inFlight: number;
	turn: ToolTurnStats;
};

type InFlightTool = {
	toolCallId: string;
	toolName: string;
	startedAt: number;
	queryId: string | undefined;
};

export class ToolExecutionTracker {
	private readonly inFlight = new Map<string, InFlightTool>();
	private readonly byTool = new Map<
		string,
		{ count: number; errors: number; totalMs: number }
	>();
	private executions = 0;
	private errors = 0;
	private totalMs = 0;
	private turnExecutions = 0;
	private turnErrors = 0;
	private turnTotalMs = 0;
	private last: ToolExecutionSample | undefined;

	beginTurn(): void {
		this.turnExecutions = 0;
		this.turnErrors = 0;
		this.turnTotalMs = 0;
	}

	begin(
		toolCallId: string,
		toolName: string,
		queryId: string | undefined,
		now = Date.now(),
	): void {
		this.inFlight.set(toolCallId, {
			toolCallId,
			toolName,
			startedAt: now,
			queryId,
		});
	}

	complete(
		toolCallId: string,
		toolName: string,
		isError: boolean,
		now = Date.now(),
	): ToolExecutionSample | undefined {
		const started = this.inFlight.get(toolCallId);
		this.inFlight.delete(toolCallId);

		const durationMs = Math.max(0, now - (started?.startedAt ?? now));
		const resolvedName = started?.toolName || toolName;
		const sample: ToolExecutionSample = {
			toolName: resolvedName,
			durationMs,
			isError,
			timestamp: now,
			queryId: started?.queryId,
		};

		this.executions += 1;
		this.totalMs += durationMs;
		this.turnExecutions += 1;
		this.turnTotalMs += durationMs;
		if (isError) {
			this.errors += 1;
			this.turnErrors += 1;
		}

		const current = this.byTool.get(resolvedName) ?? {
			count: 0,
			errors: 0,
			totalMs: 0,
		};
		current.count += 1;
		current.totalMs += durationMs;
		if (isError) current.errors += 1;
		this.byTool.set(resolvedName, current);
		this.last = sample;
		return sample;
	}

	getTurnStats(): ToolTurnStats {
		return {
			executions: this.turnExecutions,
			errors: this.turnErrors,
			totalMs: this.turnTotalMs,
		};
	}

	get(): ToolSessionStats {
		const byTool = [...this.byTool.entries()]
			.map(([toolName, stats]) => ({
				toolName,
				count: stats.count,
				errors: stats.errors,
				totalMs: stats.totalMs,
				avgMs: stats.count > 0 ? Math.round(stats.totalMs / stats.count) : 0,
			}))
			.sort((left, right) => {
				if (right.count !== left.count) return right.count - left.count;
				return left.toolName.localeCompare(right.toolName);
			});

		return {
			executions: this.executions,
			errors: this.errors,
			totalMs: this.totalMs,
			avgMs:
				this.executions > 0 ? Math.round(this.totalMs / this.executions) : 0,
			byTool,
			last: this.last,
			inFlight: this.inFlight.size,
			turn: this.getTurnStats(),
		};
	}

	reset(): void {
		this.inFlight.clear();
		this.byTool.clear();
		this.executions = 0;
		this.errors = 0;
		this.totalMs = 0;
		this.turnExecutions = 0;
		this.turnErrors = 0;
		this.turnTotalMs = 0;
		this.last = undefined;
	}
}

export function formatToolSessionLines(stats: ToolSessionStats): string[] {
	if (stats.executions === 0 && stats.inFlight === 0) {
		return ["  none yet"];
	}

	const lines = [
		`  Executions: ${stats.executions}${stats.errors > 0 ? ` (${stats.errors} errors)` : ""}`,
	];
	if (stats.executions > 0) {
		lines.push(`  Avg duration: ${stats.avgMs} ms`);
	}
	if (stats.inFlight > 0) {
		lines.push(`  In flight: ${stats.inFlight}`);
	}
	if (stats.last) {
		lines.push(
			`  Last: ${stats.last.toolName} (${stats.last.durationMs} ms${stats.last.isError ? ", error" : ""})`,
		);
	}
	if (stats.byTool.length > 0) {
		const top = stats.byTool
			.slice(0, 8)
			.map((entry) =>
				entry.errors > 0
					? `${entry.toolName} ${entry.count}(!${entry.errors})`
					: `${entry.toolName} ${entry.count}`,
			)
			.join(" · ");
		lines.push(`  By tool: ${top}`);
	}
	return lines;
}
