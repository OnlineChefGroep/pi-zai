import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_DIR_NAME, getAgentDir } from "@earendil-works/pi-coding-agent";
const DEFAULT_METRICS = {
    mode: "local",
    retentionDays: 30,
    rollupRetentionDays: 180,
    maxDatabaseBytes: 32 * 1024 * 1024,
};
const PROMPT_STABILITY_MODES = new Set([
    "off",
    "observe",
    "safe",
]);
const SESSION_AFFINITY_MODES = new Set([
    "off",
    "observe",
    "experimental",
]);
const METRICS_MODES = new Set(["off", "memory", "local"]);
const TELEMETRY_MODES = new Set(["off", "aggregate"]);
function readSettingsFile(path) {
    if (!existsSync(path))
        return undefined;
    try {
        const raw = readFileSync(path, "utf-8");
        const parsed = JSON.parse(raw);
        return typeof parsed === "object" && parsed !== null
            ? parsed
            : undefined;
    }
    catch {
        return undefined;
    }
}
function readZaiSettingsSection(cwd) {
    const global = readSettingsFile(join(getAgentDir(), "settings.json"));
    const project = readSettingsFile(join(cwd, CONFIG_DIR_NAME, "settings.json"));
    const globalZai = global?.zai;
    const projectZai = project?.zai;
    if ((globalZai === undefined ||
        typeof globalZai !== "object" ||
        globalZai === null) &&
        (projectZai === undefined ||
            typeof projectZai !== "object" ||
            projectZai === null)) {
        return undefined;
    }
    return {
        ...(typeof globalZai === "object" && globalZai !== null
            ? globalZai
            : {}),
        ...(typeof projectZai === "object" && projectZai !== null
            ? projectZai
            : {}),
    };
}
function parseEnum(value, allowed, fallback) {
    return typeof value === "string" && allowed.has(value)
        ? value
        : fallback;
}
function parsePositiveInt(value, fallback) {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        return fallback;
    }
    return Math.floor(value);
}
function loadMetricsConfig(settings) {
    const metrics = settings?.metrics;
    return {
        mode: parseEnum(metrics?.mode, METRICS_MODES, DEFAULT_METRICS.mode),
        retentionDays: parsePositiveInt(metrics?.retentionDays, DEFAULT_METRICS.retentionDays),
        rollupRetentionDays: parsePositiveInt(metrics?.rollupRetentionDays, DEFAULT_METRICS.rollupRetentionDays),
        maxDatabaseBytes: parsePositiveInt(metrics?.maxDatabaseBytes, DEFAULT_METRICS.maxDatabaseBytes),
    };
}
function loadTelemetryConfig(settings) {
    const telemetry = settings?.telemetry;
    const ingestUrl = typeof telemetry?.ingestUrl === "string" &&
        telemetry.ingestUrl.trim().length > 0
        ? telemetry.ingestUrl.trim()
        : undefined;
    return {
        mode: parseEnum(telemetry?.mode, TELEMETRY_MODES, "off"),
        ingestUrl,
    };
}
export function loadZaiConfig(cwd = process.cwd()) {
    const settings = readZaiSettingsSection(cwd);
    const telemetry = loadTelemetryConfig(settings);
    return {
        // Undefined deliberately means no override: Pi currently emits
        // clear_thinking=false for enabled native Z.AI thinking.
        preserveThinking: settings?.preserveThinking,
        statusTps: settings?.statusTps ?? true,
        statusTpsAvg: settings?.statusTpsAvg ?? false,
        promptStabilityMode: parseEnum(settings?.promptStability?.mode, PROMPT_STABILITY_MODES, "observe"),
        sessionAffinity: parseEnum(settings?.sessionAffinity, SESSION_AFFINITY_MODES, "off"),
        metrics: loadMetricsConfig(settings),
        telemetryMode: telemetry.mode,
        telemetryIngestUrl: telemetry.ingestUrl,
    };
}
//# sourceMappingURL=config.js.map