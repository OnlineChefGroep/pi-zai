export function computeTps(outputTokens, durationMs) {
    if (outputTokens <= 0 || durationMs <= 0) {
        return 0;
    }
    return outputTokens / (durationMs / 1000);
}
export function formatTps(value) {
    if (value <= 0) {
        return "0";
    }
    return Math.round(value).toString();
}
export function formatDurationMs(durationMs) {
    if (durationMs < 1000) {
        return `${Math.round(durationMs)}ms`;
    }
    return `${(durationMs / 1000).toFixed(1)}s`;
}
export function formatTpsStatusLine(sample, rolling, showAvg) {
    const last = formatTps(sample.tps);
    if (!showAvg || rolling.requests <= 1) {
        return `${last} tok/s`;
    }
    return `${last} tok/s (avg ${formatTps(rolling.avgTps)})`;
}
export function formatTpsTelemetryLines(stats) {
    if (!stats?.last) {
        return ["  none"];
    }
    const { last, rolling } = stats;
    const lines = [
        `  Last stream: ${formatTps(last.tps)} output tok/s (${formatDurationMs(last.durationMs)} stream wall, ${last.outputTokens.toLocaleString("en-US")} output)`,
    ];
    if (last.ttftMs !== undefined) {
        lines.push(`  First content delta after stream start: ${formatDurationMs(last.ttftMs)}`);
    }
    if (rolling.requests > 0) {
        lines.push(`  Session stream avg: ${formatTps(rolling.avgTps)} output tok/s (${rolling.requests} ${rolling.requests === 1 ? "assistant stream" : "assistant streams"})`);
    }
    return lines;
}
export function formatTurnThroughputLines(turn) {
    if (!turn?.last) {
        return [];
    }
    const { last } = turn;
    const lines = [
        `  Turn: ${formatTps(last.effectiveTps)} tok/s effective (${formatDurationMs(last.wallMs)} wall, ${last.outputTokens.toLocaleString("en-US")} out)`,
        `  Assistant streams: ${formatTps(last.generationTps)} output tok/s (${formatDurationMs(last.generationMs)} stream wall)`,
    ];
    if (last.toolCalls > 0) {
        lines.push(`  Tools: ${last.toolCalls} call${last.toolCalls === 1 ? "" : "s"}, ${formatDurationMs(last.toolMs)}`);
    }
    return lines;
}
export class TpsTracker {
    inFlight;
    turnStartedAt;
    turnOutputTokens = 0;
    turnGenerationMs = 0;
    stats = {
        last: undefined,
        rolling: {
            generationTokens: 0,
            durationMs: 0,
            requests: 0,
            avgTps: 0,
        },
        turn: { last: undefined },
    };
    beginTurn(startedAt = Date.now()) {
        this.turnStartedAt = startedAt;
        this.turnOutputTokens = 0;
        this.turnGenerationMs = 0;
    }
    completeTurn(input) {
        if (this.turnStartedAt === undefined || this.turnOutputTokens <= 0) {
            return undefined;
        }
        const endedAt = input.endedAt ?? Date.now();
        const wallMs = Math.max(1, endedAt - this.turnStartedAt);
        const generationMs = Math.max(1, this.turnGenerationMs);
        const sample = {
            outputTokens: this.turnOutputTokens,
            generationMs: this.turnGenerationMs,
            toolMs: input.toolMs,
            toolCalls: input.toolCalls,
            wallMs,
            generationTps: computeTps(this.turnOutputTokens, generationMs),
            effectiveTps: computeTps(this.turnOutputTokens, wallMs),
        };
        this.stats.turn.last = sample;
        this.turnStartedAt = undefined;
        this.turnOutputTokens = 0;
        this.turnGenerationMs = 0;
        return sample;
    }
    beginAssistantMessage(startedAt = Date.now()) {
        this.inFlight = { startedAt, ttftMs: undefined };
    }
    markFirstToken(now = Date.now()) {
        if (!this.inFlight || this.inFlight.ttftMs !== undefined) {
            return;
        }
        this.inFlight.ttftMs = Math.max(0, now - this.inFlight.startedAt);
    }
    completeAssistantMessage(usage, endedAt = Date.now()) {
        if (!this.inFlight) {
            return undefined;
        }
        const durationMs = Math.max(1, endedAt - this.inFlight.startedAt);
        const outputTokens = usage.output;
        const sample = {
            outputTokens,
            reasoningTokens: usage.reasoning ?? 0,
            durationMs,
            ttftMs: this.inFlight.ttftMs,
            tps: computeTps(outputTokens, durationMs),
            timestamp: endedAt,
        };
        const rolling = this.stats.rolling;
        rolling.generationTokens += outputTokens;
        rolling.durationMs += durationMs;
        rolling.requests += 1;
        rolling.avgTps = computeTps(rolling.generationTokens, rolling.durationMs);
        this.turnOutputTokens += outputTokens;
        this.turnGenerationMs += durationMs;
        this.stats.last = sample;
        this.inFlight = undefined;
        return sample;
    }
    get() {
        return this.stats;
    }
    reset() {
        this.inFlight = undefined;
        this.turnStartedAt = undefined;
        this.turnOutputTokens = 0;
        this.turnGenerationMs = 0;
        this.stats = {
            last: undefined,
            rolling: {
                generationTokens: 0,
                durationMs: 0,
                requests: 0,
                avgTps: 0,
            },
            turn: { last: undefined },
        };
    }
}
//# sourceMappingURL=tps.js.map