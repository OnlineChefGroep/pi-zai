import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_DIR_NAME, getAgentDir } from "@earendil-works/pi-coding-agent";

export type ZaiMetricsMode = "off" | "memory" | "local";
export type ZaiTelemetryMode = "off";

export interface ZaiMetricsSettings {
	mode?: ZaiMetricsMode;
	retentionDays?: number;
	rollupRetentionDays?: number;
	maxDatabaseBytes?: number;
}

export interface ZaiTelemetrySettings {
	mode?: ZaiTelemetryMode;
}

export interface ZaiSettings {
	preserveThinking?: boolean;
	metrics?: ZaiMetricsSettings;
	telemetry?: ZaiTelemetrySettings;
}

export interface ZaiMetricsConfig {
	mode: ZaiMetricsMode;
	retentionDays: number;
	rollupRetentionDays: number;
	maxDatabaseBytes: number;
}

export interface ZaiConfig {
	preserveThinking: boolean;
	metrics: ZaiMetricsConfig;
	telemetry: {
		mode: ZaiTelemetryMode;
	};
}

const DEFAULT_METRICS: ZaiMetricsConfig = {
	mode: "local",
	retentionDays: 30,
	rollupRetentionDays: 180,
	maxDatabaseBytes: 32 * 1024 * 1024,
};

function readSettingsFile(path: string): Record<string, unknown> | undefined {
	if (!existsSync(path)) return undefined;
	try {
		const raw = readFileSync(path, "utf-8");
		const parsed = JSON.parse(raw);
		return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : undefined;
	} catch {
		return undefined;
	}
}

function asZaiSettings(value: unknown): ZaiSettings | undefined {
	return typeof value === "object" && value !== null ? (value as ZaiSettings) : undefined;
}

function readZaiSettingsSection(cwd: string): ZaiSettings | undefined {
	const global = asZaiSettings(readSettingsFile(join(getAgentDir(), "settings.json"))?.zai);
	const project = asZaiSettings(readSettingsFile(join(cwd, CONFIG_DIR_NAME, "settings.json"))?.zai);
	if (!global && !project) return undefined;
	return {
		...global,
		...project,
		metrics: {
			...global?.metrics,
			...project?.metrics,
		},
		telemetry: {
			...global?.telemetry,
			...project?.telemetry,
		},
	};
}

function parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
	if (value === undefined) return defaultValue;
	const normalized = value.trim().toLowerCase();
	if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") return true;
	if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") return false;
	return defaultValue;
}

function parseMetricsMode(value: unknown): ZaiMetricsMode {
	return value === "off" || value === "memory" || value === "local" ? value : DEFAULT_METRICS.mode;
}

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
	return Math.min(maximum, Math.max(minimum, Math.trunc(value)));
}

export function loadZaiConfig(cwd = process.cwd()): ZaiConfig {
	const settings = readZaiSettingsSection(cwd);
	const preserveThinking =
		process.env.PI_ZAI_PRESERVE_THINKING !== undefined
			? parseBooleanEnv(process.env.PI_ZAI_PRESERVE_THINKING, false)
			: (settings?.preserveThinking ?? false);

	return {
		preserveThinking,
		metrics: {
			mode: parseMetricsMode(settings?.metrics?.mode),
			retentionDays: boundedInteger(settings?.metrics?.retentionDays, DEFAULT_METRICS.retentionDays, 1, 3650),
			rollupRetentionDays: boundedInteger(
				settings?.metrics?.rollupRetentionDays,
				DEFAULT_METRICS.rollupRetentionDays,
				1,
				3650,
			),
			maxDatabaseBytes: boundedInteger(
				settings?.metrics?.maxDatabaseBytes,
				DEFAULT_METRICS.maxDatabaseBytes,
				1024 * 1024,
				1024 * 1024 * 1024,
			),
		},
		telemetry: {
			mode: "off",
		},
	};
}
