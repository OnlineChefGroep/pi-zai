import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_DIR_NAME, getAgentDir } from "@earendil-works/pi-coding-agent";

export type PromptStabilityMode = "off" | "observe" | "safe";
export type SessionAffinityMode = "off" | "observe" | "experimental";
export type AdaptiveToolsMode =
	| "off"
	| "observe"
	| "manual"
	| "adaptive"
	| "strict";
export type MetricsMode = "off" | "memory" | "local";
export type TelemetryMode = "off" | "aggregate";

export interface ZaiMetricsSettings {
	mode?: MetricsMode;
	retentionDays?: number;
	rollupRetentionDays?: number;
	maxDatabaseBytes?: number;
}

export interface ZaiPromptStabilitySettings {
	mode?: PromptStabilityMode;
}

export interface ZaiTelemetrySettings {
	mode?: TelemetryMode;
	ingestUrl?: string;
}

export interface ZaiAdaptiveToolsSettings {
	mode?: AdaptiveToolsMode;
	maxInitialTools?: number;
	stickyLoadedTools?: boolean;
	alwaysActive?: string[];
	groups?: Record<string, string[]>;
}

export interface ZaiSettings {
	/**
	 * Optional override for Pi's native Z.AI preserved-thinking behavior.
	 * Omit to leave the upstream request payload unchanged.
	 */
	preserveThinking?: boolean;
	statusTps?: boolean;
	statusTpsAvg?: boolean;
	promptStability?: ZaiPromptStabilitySettings;
	sessionAffinity?: SessionAffinityMode;
	adaptiveTools?: ZaiAdaptiveToolsSettings;
	metrics?: ZaiMetricsSettings;
	telemetry?: ZaiTelemetrySettings;
}

export interface ZaiMetricsConfig {
	mode: MetricsMode;
	retentionDays: number;
	rollupRetentionDays: number;
	maxDatabaseBytes: number;
}

export interface ZaiAdaptiveToolsConfig {
	mode: AdaptiveToolsMode;
	maxInitialTools: number;
	stickyLoadedTools: boolean;
	alwaysActive: string[];
	groups: Record<string, string[]>;
	unsupportedMode: boolean;
}

export interface ZaiConfig {
	/** Undefined means: preserve Pi's native payload unchanged. */
	preserveThinking: boolean | undefined;
	statusTps: boolean;
	statusTpsAvg: boolean;
	promptStabilityMode: PromptStabilityMode;
	sessionAffinity: SessionAffinityMode;
	adaptiveTools: ZaiAdaptiveToolsConfig;
	metrics: ZaiMetricsConfig;
	telemetryMode: TelemetryMode;
	telemetryIngestUrl?: string;
}

const DEFAULT_METRICS: ZaiMetricsConfig = {
	mode: "local",
	retentionDays: 30,
	rollupRetentionDays: 180,
	maxDatabaseBytes: 32 * 1024 * 1024,
};

const PROMPT_STABILITY_MODES = new Set<PromptStabilityMode>([
	"off",
	"observe",
	"safe",
]);
const SESSION_AFFINITY_MODES = new Set<SessionAffinityMode>([
	"off",
	"observe",
	"experimental",
]);
const ADAPTIVE_TOOLS_MODES = new Set<AdaptiveToolsMode>([
	"off",
	"observe",
	"manual",
	"adaptive",
	"strict",
]);
const DEFAULT_ALWAYS_ACTIVE = [
	"read",
	"grep",
	"find",
	"ls",
	"zai_load_tools",
] as const;

const METRICS_MODES = new Set<MetricsMode>(["off", "memory", "local"]);
const TELEMETRY_MODES = new Set<TelemetryMode>(["off", "aggregate"]);

function readSettingsFile(path: string): Record<string, unknown> | undefined {
	if (!existsSync(path)) return undefined;
	try {
		const raw = readFileSync(path, "utf-8");
		const parsed = JSON.parse(raw);
		return typeof parsed === "object" && parsed !== null
			? (parsed as Record<string, unknown>)
			: undefined;
	} catch {
		return undefined;
	}
}

function readZaiSettingsSection(cwd: string): ZaiSettings | undefined {
	const global = readSettingsFile(join(getAgentDir(), "settings.json"));
	const project = readSettingsFile(join(cwd, CONFIG_DIR_NAME, "settings.json"));
	const globalZai = global?.zai;
	const projectZai = project?.zai;
	if (
		(globalZai === undefined ||
			typeof globalZai !== "object" ||
			globalZai === null) &&
		(projectZai === undefined ||
			typeof projectZai !== "object" ||
			projectZai === null)
	) {
		return undefined;
	}
	return {
		...(typeof globalZai === "object" && globalZai !== null
			? (globalZai as ZaiSettings)
			: {}),
		...(typeof projectZai === "object" && projectZai !== null
			? (projectZai as ZaiSettings)
			: {}),
	};
}

function parseEnum<T extends string>(
	value: unknown,
	allowed: Set<T>,
	fallback: T,
): T {
	return typeof value === "string" && allowed.has(value as T)
		? (value as T)
		: fallback;
}

function parsePositiveInt(value: unknown, fallback: number): number {
	if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
		return fallback;
	}
	return Math.floor(value);
}

function loadMetricsConfig(
	settings: ZaiSettings | undefined,
): ZaiMetricsConfig {
	const metrics = settings?.metrics;
	return {
		mode: parseEnum(metrics?.mode, METRICS_MODES, DEFAULT_METRICS.mode),
		retentionDays: parsePositiveInt(
			metrics?.retentionDays,
			DEFAULT_METRICS.retentionDays,
		),
		rollupRetentionDays: parsePositiveInt(
			metrics?.rollupRetentionDays,
			DEFAULT_METRICS.rollupRetentionDays,
		),
		maxDatabaseBytes: parsePositiveInt(
			metrics?.maxDatabaseBytes,
			DEFAULT_METRICS.maxDatabaseBytes,
		),
	};
}

function loadTelemetryConfig(settings: ZaiSettings | undefined): {
	mode: TelemetryMode;
	ingestUrl?: string;
} {
	const telemetry = settings?.telemetry;
	const ingestUrl =
		typeof telemetry?.ingestUrl === "string" &&
		telemetry.ingestUrl.trim().length > 0
			? telemetry.ingestUrl.trim()
			: undefined;
	return {
		mode: parseEnum(telemetry?.mode, TELEMETRY_MODES, "off"),
		ingestUrl,
	};
}

function loadAdaptiveToolsConfig(
	settings: ZaiSettings | undefined,
): ZaiAdaptiveToolsConfig {
	const adaptive = settings?.adaptiveTools;
	const rawMode = parseEnum(adaptive?.mode, ADAPTIVE_TOOLS_MODES, "off");
	// 0.5.0 ships off|observe|manual. adaptive/strict are accepted but unsupported.
	const unsupportedMode = rawMode === "adaptive" || rawMode === "strict";
	const mode: AdaptiveToolsMode = unsupportedMode ? "observe" : rawMode;
	const alwaysActive =
		Array.isArray(adaptive?.alwaysActive) && adaptive.alwaysActive.length > 0
			? adaptive.alwaysActive.filter(
					(name): name is string =>
						typeof name === "string" && name.trim().length > 0,
				)
			: [...DEFAULT_ALWAYS_ACTIVE];
	const groups: Record<string, string[]> = {};
	if (adaptive?.groups && typeof adaptive.groups === "object") {
		for (const [group, tools] of Object.entries(adaptive.groups)) {
			if (!Array.isArray(tools)) continue;
			groups[group] = tools.filter(
				(name): name is string =>
					typeof name === "string" && name.trim().length > 0,
			);
		}
	}
	return {
		mode,
		maxInitialTools: parsePositiveInt(adaptive?.maxInitialTools, 8),
		stickyLoadedTools: adaptive?.stickyLoadedTools ?? true,
		alwaysActive,
		groups,
		unsupportedMode,
	};
}

export function loadZaiConfig(cwd = process.cwd()): ZaiConfig {
	const settings = readZaiSettingsSection(cwd);
	const telemetry = loadTelemetryConfig(settings);

	return {
		// Undefined deliberately means no override: Pi currently emits
		// clear_thinking=false for enabled native Z.AI thinking.
		preserveThinking: settings?.preserveThinking,
		statusTps: settings?.statusTps ?? true,
		statusTpsAvg: settings?.statusTpsAvg ?? false,
		promptStabilityMode: parseEnum(
			settings?.promptStability?.mode,
			PROMPT_STABILITY_MODES,
			"observe",
		),
		sessionAffinity: parseEnum(
			settings?.sessionAffinity,
			SESSION_AFFINITY_MODES,
			"off",
		),
		adaptiveTools: loadAdaptiveToolsConfig(settings),
		metrics: loadMetricsConfig(settings),
		telemetryMode: telemetry.mode,
		telemetryIngestUrl: telemetry.ingestUrl,
	};
}
