from pathlib import Path


def write(path: str, content: str) -> None:
    Path(path).write_text(content.rstrip() + "\n", encoding="utf-8")


def replace_exact(path: str, before: str, after: str) -> None:
    file = Path(path)
    content = file.read_text(encoding="utf-8")
    if before not in content:
        raise RuntimeError(f"Expected block not found in {path}: {before[:120]!r}")
    file.write_text(content.replace(before, after, 1), encoding="utf-8")


write(
    "src/adaptive-tools/observe.ts",
    '''import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ZaiAdaptiveToolsConfig } from "../config.ts";
import { collectDeferredToolNames } from "./groups.ts";

export interface AdaptiveToolObservation {
\tactiveCount: number;
\tdeferredCount: number;
\testimatedDeferredSchemaBytes: number;
\tconfiguredGroupCount: number;
}

function estimateSchemaBytes(value: unknown): number {
\ttry {
\t\treturn Buffer.byteLength(JSON.stringify(value ?? null), "utf8");
\t} catch {
\t\treturn 0;
\t}
}

export function observeAdaptiveToolImpact(
\tpi: ExtensionAPI,
\tconfig: ZaiAdaptiveToolsConfig,
): AdaptiveToolObservation {
\tconst active = new Set(pi.getActiveTools());
\tconst deferred = collectDeferredToolNames(config);
\tlet estimatedDeferredSchemaBytes = 0;
\tfor (const tool of pi.getAllTools()) {
\t\tif (!deferred.has(tool.name)) continue;
\t\testimatedDeferredSchemaBytes += estimateSchemaBytes({
\t\t\tname: tool.name,
\t\t\tdescription: tool.description,
\t\t\tparameters: tool.parameters,
\t\t});
\t}
\treturn {
\t\tactiveCount: active.size,
\t\tdeferredCount: [...deferred].filter((name) => active.has(name)).length,
\t\testimatedDeferredSchemaBytes,
\t\tconfiguredGroupCount: Object.keys(config.groups).length,
\t};
}
''',
)

write(
    "src/adaptive-tools/loader-tool.ts",
    '''import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import type { ZaiAdaptiveToolsConfig } from "../config.ts";
import { sessionState } from "../state.ts";
import {
\tlistConfiguredGroups,
\tresolveExistingToolNames,
\tresolveGroupTools,
} from "./groups.ts";
import { type AdaptiveLoadResult, LOADER_TOOL_NAME } from "./types.ts";

const LOADER_PARAMS = Type.Object({
\tgroup: Type.String({
\t\tdescription:
\t\t\t"Configured tool group name to activate additively for this session",
\t}),
});

export function registerAdaptiveLoaderTool(
\tpi: ExtensionAPI,
\tgetConfig: () => ZaiAdaptiveToolsConfig,
\tonLoaded: (toolNames: string[]) => void = () => {},
): void {
\tpi.registerTool({
\t\tname: LOADER_TOOL_NAME,
\t\tlabel: "Z.AI Load Tools",
\t\tdescription:
\t\t\t"Activate a configured Z.AI tool group for the rest of this session. Use only group names from configuration.",
\t\tparameters: LOADER_PARAMS,
\t\tasync execute(_toolCallId, params) {
\t\t\tconst config = getConfig();
\t\t\tconst group = String(params.group ?? "").trim();
\t\t\tconst groups = listConfiguredGroups(config);
\t\t\tif (!group) {
\t\t\t\treturn {
\t\t\t\t\tcontent: [
\t\t\t\t\t\t{
\t\t\t\t\t\t\ttype: "text" as const,
\t\t\t\t\t\t\ttext: `Missing group. Available groups: ${groups.join(", ") || "(none configured)"}`,
\t\t\t\t\t\t},
\t\t\t\t\t],
\t\t\t\t\tdetails: {
\t\t\t\t\t\trequested: [],
\t\t\t\t\t\tadded: [],
\t\t\t\t\t\talreadyActive: [],
\t\t\t\t\t\tunknown: [],
\t\t\t\t\t} satisfies AdaptiveLoadResult,
\t\t\t\t};
\t\t\t}

\t\t\tconst requested = resolveGroupTools(config, group);
\t\t\tif (!requested) {
\t\t\t\treturn {
\t\t\t\t\tcontent: [
\t\t\t\t\t\t{
\t\t\t\t\t\t\ttype: "text" as const,
\t\t\t\t\t\t\ttext: `Unknown group "${group}". Available groups: ${groups.join(", ") || "(none configured)"}`,
\t\t\t\t\t\t},
\t\t\t\t\t],
\t\t\t\t\tdetails: {
\t\t\t\t\t\trequested: [],
\t\t\t\t\t\tadded: [],
\t\t\t\t\t\talreadyActive: [],
\t\t\t\t\t\tunknown: [group],
\t\t\t\t\t} satisfies AdaptiveLoadResult,
\t\t\t\t};
\t\t\t}

\t\t\tconst existing = resolveExistingToolNames(pi, requested);
\t\t\tconst unknown = requested.filter((name) => !existing.includes(name));
\t\t\tconst active = pi.getActiveTools();
\t\t\tconst activeSet = new Set(active);
\t\t\tconst added = existing.filter((name) => !activeSet.has(name));
\t\t\tconst alreadyActive = existing.filter((name) => activeSet.has(name));

\t\t\tif (added.length > 0) {
\t\t\t\tpi.setActiveTools([...new Set([...active, ...added])]);
\t\t\t\tonLoaded(added);
\t\t\t}

\t\t\tif (!sessionState.adaptiveTools) {
\t\t\t\tsessionState.adaptiveTools = {
\t\t\t\t\tmode: config.mode,
\t\t\t\t\tloaderInvocations: 0,
\t\t\t\t\tlastAddedCount: 0,
\t\t\t\t};
\t\t\t}
\t\t\tsessionState.adaptiveTools.loaderInvocations += 1;
\t\t\tsessionState.adaptiveTools.lastAddedCount = added.length;

\t\t\tconst summary =
\t\t\t\tadded.length > 0
\t\t\t\t\t? `Loaded tools for group "${group}": ${added.join(", ")}`
\t\t\t\t\t: `Group "${group}" already active${unknown.length ? `; unknown: ${unknown.join(", ")}` : ""}`;

\t\t\treturn {
\t\t\t\tcontent: [{ type: "text" as const, text: summary }],
\t\t\t\tdetails: {
\t\t\t\t\trequested: existing,
\t\t\t\t\tadded,
\t\t\t\t\talreadyActive,
\t\t\t\t\tunknown,
\t\t\t\t} satisfies AdaptiveLoadResult,
\t\t\t};
\t\t},
\t});
}
''',
)

write(
    "src/adaptive-tools/session-policy.ts",
    '''import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ZaiAdaptiveToolsConfig } from "../config.ts";
import { sessionState } from "../state.ts";
import {
\tcollectDeferredToolNames,
\tresolveExistingToolNames,
} from "./groups.ts";
import { registerAdaptiveLoaderTool } from "./loader-tool.ts";
import { observeAdaptiveToolImpact } from "./observe.ts";
import { LOADER_TOOL_NAME } from "./types.ts";

export interface AdaptiveToolsSessionPolicy {
\tapply(): void;
\trestore(): void;
}

function sameNames(left: string[], right: string[]): boolean {
\tif (left.length !== right.length) return false;
\treturn left.every((name, index) => name === right[index]);
}

export function createAdaptiveToolsSessionPolicy(
\tpi: ExtensionAPI,
\tgetConfig: () => ZaiAdaptiveToolsConfig,
): AdaptiveToolsSessionPolicy {
\tlet loaderRegistered = false;
\tlet active = false;
\tlet baselineActive = new Set<string>();
\tlet controlledNames = new Set<string>();
\tconst loadedNames = new Set<string>();

\tconst updateState = (
\t\tconfig: ZaiAdaptiveToolsConfig,
\t\tobservation = sessionState.adaptiveTools?.observation,
\t): void => {
\t\tsessionState.adaptiveTools = {
\t\t\tmode: config.mode,
\t\t\tloaderInvocations: sessionState.adaptiveTools?.loaderInvocations ?? 0,
\t\t\tlastAddedCount: sessionState.adaptiveTools?.lastAddedCount ?? 0,
\t\t\tobservation,
\t\t};
\t};

\tconst setActiveToolsIfChanged = (next: Set<string>): void => {
\t\tconst current = pi.getActiveTools();
\t\tconst normalized = [...next];
\t\tif (!sameNames(current, normalized)) {
\t\t\tpi.setActiveTools(normalized);
\t\t}
\t};

\tconst restore = (): void => {
\t\tif (!active) return;
\t\tconst next = new Set(pi.getActiveTools());
\t\tfor (const name of controlledNames) {
\t\t\tif (baselineActive.has(name)) next.add(name);
\t\t\telse next.delete(name);
\t\t}
\t\tsetActiveToolsIfChanged(next);
\t\tactive = false;
\t\tbaselineActive = new Set();
\t\tcontrolledNames = new Set();
\t\tloadedNames.clear();
\t};

\tconst apply = (): void => {
\t\tconst config = getConfig();
\t\tif (active) restore();

\t\tconst observation = observeAdaptiveToolImpact(pi, config);
\t\tupdateState(config, observation);

\t\tif (config.mode === "off" || config.mode === "observe") {
\t\t\treturn;
\t\t}
\t\tif (config.mode !== "manual") return;

\t\tbaselineActive = new Set(pi.getActiveTools());
\t\tif (!loaderRegistered) {
\t\t\tregisterAdaptiveLoaderTool(pi, getConfig, (toolNames) => {
\t\t\t\tfor (const name of toolNames) loadedNames.add(name);
\t\t\t});
\t\t\tloaderRegistered = true;
\t\t}

\t\tconst deferred = collectDeferredToolNames(config);
\t\tcontrolledNames = new Set([...deferred, LOADER_TOOL_NAME]);
\t\tconst next = new Set(pi.getActiveTools());
\t\tfor (const name of deferred) {
\t\t\tif (!loadedNames.has(name)) next.delete(name);
\t\t}
\t\tfor (const name of resolveExistingToolNames(pi, config.alwaysActive)) {
\t\t\tnext.add(name);
\t\t}
\t\tnext.add(LOADER_TOOL_NAME);
\t\tsetActiveToolsIfChanged(next);
\t\tactive = true;
\t};

\treturn { apply, restore };
}
''',
)

write(
    "src/adaptive-tools/index.ts",
    '''export {
\tcollectDeferredToolNames,
\tlistConfiguredGroups,
\tresolveExistingToolNames,
\tresolveGroupTools,
} from "./groups.ts";
export {
\tobserveAdaptiveToolImpact,
\ttype AdaptiveToolObservation,
} from "./observe.ts";
export {
\tcreateAdaptiveToolsSessionPolicy,
\ttype AdaptiveToolsSessionPolicy,
} from "./session-policy.ts";
export { LOADER_TOOL_NAME } from "./types.ts";
''',
)

write(
    "src/config.ts",
    '''import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_DIR_NAME, getAgentDir } from "@earendil-works/pi-coding-agent";

export type PromptStabilityMode = "off" | "observe" | "safe";
export type SessionAffinityMode = "off" | "observe" | "experimental";
export type AdaptiveToolsMode =
\t| "off"
\t| "observe"
\t| "manual"
\t| "adaptive"
\t| "strict";
export type MetricsMode = "off" | "memory" | "local";
export type TelemetryMode = "off" | "aggregate";

export interface ZaiMetricsSettings {
\tmode?: MetricsMode;
\tretentionDays?: number;
\trollupRetentionDays?: number;
\tmaxDatabaseBytes?: number;
}

export interface ZaiPromptStabilitySettings {
\tmode?: PromptStabilityMode;
}

export interface ZaiTelemetrySettings {
\tmode?: TelemetryMode;
\tingestUrl?: string;
}

export interface ZaiAdaptiveToolsSettings {
\tmode?: AdaptiveToolsMode;
\talwaysActive?: string[];
\tgroups?: Record<string, string[]>;
}

export interface ZaiSettings {
\t/**
\t * Optional override for Pi's native Z.AI preserved-thinking behavior.
\t * Omit to leave the upstream request payload unchanged.
\t */
\tpreserveThinking?: boolean;
\tstatusTps?: boolean;
\tstatusTpsAvg?: boolean;
\tpromptStability?: ZaiPromptStabilitySettings;
\tsessionAffinity?: SessionAffinityMode;
\tadaptiveTools?: ZaiAdaptiveToolsSettings;
\tmetrics?: ZaiMetricsSettings;
\ttelemetry?: ZaiTelemetrySettings;
}

export interface ZaiMetricsConfig {
\tmode: MetricsMode;
\tretentionDays: number;
\trollupRetentionDays: number;
\tmaxDatabaseBytes: number;
}

export interface ZaiAdaptiveToolsConfig {
\tmode: AdaptiveToolsMode;
\trequestedMode: AdaptiveToolsMode;
\talwaysActive: string[];
\tgroups: Record<string, string[]>;
\tunsupportedMode: boolean;
}

export interface ZaiConfig {
\t/** Undefined means: preserve Pi's native payload unchanged. */
\tpreserveThinking: boolean | undefined;
\tstatusTps: boolean;
\tstatusTpsAvg: boolean;
\tpromptStabilityMode: PromptStabilityMode;
\tsessionAffinity: SessionAffinityMode;
\tadaptiveTools: ZaiAdaptiveToolsConfig;
\tmetrics: ZaiMetricsConfig;
\ttelemetryMode: TelemetryMode;
\ttelemetryIngestUrl?: string;
}

const DEFAULT_METRICS: ZaiMetricsConfig = {
\tmode: "local",
\tretentionDays: 30,
\trollupRetentionDays: 180,
\tmaxDatabaseBytes: 32 * 1024 * 1024,
};

const PROMPT_STABILITY_MODES = new Set<PromptStabilityMode>([
\t"off",
\t"observe",
\t"safe",
]);
const SESSION_AFFINITY_MODES = new Set<SessionAffinityMode>([
\t"off",
\t"observe",
\t"experimental",
]);
const ADAPTIVE_TOOLS_MODES = new Set<AdaptiveToolsMode>([
\t"off",
\t"observe",
\t"manual",
\t"adaptive",
\t"strict",
]);
const DEFAULT_ALWAYS_ACTIVE = [
\t"read",
\t"grep",
\t"find",
\t"ls",
\t"zai_load_tools",
] as const;
const METRICS_MODES = new Set<MetricsMode>(["off", "memory", "local"]);
const TELEMETRY_MODES = new Set<TelemetryMode>(["off", "aggregate"]);

function readSettingsFile(path: string): Record<string, unknown> | undefined {
\tif (!existsSync(path)) return undefined;
\ttry {
\t\tconst raw = readFileSync(path, "utf-8");
\t\tconst parsed = JSON.parse(raw);
\t\treturn typeof parsed === "object" && parsed !== null
\t\t\t? (parsed as Record<string, unknown>)
\t\t\t: undefined;
\t} catch {
\t\treturn undefined;
\t}
}

function readZaiSettingsSection(cwd: string): ZaiSettings | undefined {
\tconst global = readSettingsFile(join(getAgentDir(), "settings.json"));
\tconst project = readSettingsFile(join(cwd, CONFIG_DIR_NAME, "settings.json"));
\tconst globalZai = global?.zai;
\tconst projectZai = project?.zai;
\tif (
\t\t(globalZai === undefined ||
\t\t\ttypeof globalZai !== "object" ||
\t\t\tglobalZai === null) &&
\t\t(projectZai === undefined ||
\t\t\ttypeof projectZai !== "object" ||
\t\t\tprojectZai === null)
\t) {
\t\treturn undefined;
\t}
\treturn {
\t\t...(typeof globalZai === "object" && globalZai !== null
\t\t\t? (globalZai as ZaiSettings)
\t\t\t: {}),
\t\t...(typeof projectZai === "object" && projectZai !== null
\t\t\t? (projectZai as ZaiSettings)
\t\t\t: {}),
\t};
}

function parseEnum<T extends string>(
\tvalue: unknown,
\tallowed: Set<T>,
\tfallback: T,
): T {
\treturn typeof value === "string" && allowed.has(value as T)
\t\t? (value as T)
\t\t: fallback;
}

function parsePositiveInt(value: unknown, fallback: number): number {
\tif (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
\t\treturn fallback;
\t}
\treturn Math.floor(value);
}

function normalizeNames(value: unknown, fallback: readonly string[] = []): string[] {
\tif (!Array.isArray(value)) return [...fallback];
\tconst names = value
\t\t.filter((name): name is string => typeof name === "string")
\t\t.map((name) => name.trim())
\t\t.filter(Boolean);
\treturn [...new Set(names)];
}

function loadMetricsConfig(
\tsettings: ZaiSettings | undefined,
): ZaiMetricsConfig {
\tconst metrics = settings?.metrics;
\treturn {
\t\tmode: parseEnum(metrics?.mode, METRICS_MODES, DEFAULT_METRICS.mode),
\t\tretentionDays: parsePositiveInt(
\t\t\tmetrics?.retentionDays,
\t\t\tDEFAULT_METRICS.retentionDays,
\t\t),
\t\trollupRetentionDays: parsePositiveInt(
\t\t\tmetrics?.rollupRetentionDays,
\t\t\tDEFAULT_METRICS.rollupRetentionDays,
\t\t),
\t\tmaxDatabaseBytes: parsePositiveInt(
\t\t\tmetrics?.maxDatabaseBytes,
\t\t\tDEFAULT_METRICS.maxDatabaseBytes,
\t\t),
\t};
}

function loadTelemetryConfig(settings: ZaiSettings | undefined): {
\tmode: TelemetryMode;
\tingestUrl?: string;
} {
\tconst telemetry = settings?.telemetry;
\tconst ingestUrl =
\t\ttypeof telemetry?.ingestUrl === "string" &&
\t\ttelemetry.ingestUrl.trim().length > 0
\t\t\t? telemetry.ingestUrl.trim()
\t\t\t: undefined;
\treturn {
\t\tmode: parseEnum(telemetry?.mode, TELEMETRY_MODES, "off"),
\t\tingestUrl,
\t};
}

function loadAdaptiveToolsConfig(
\tsettings: ZaiSettings | undefined,
): ZaiAdaptiveToolsConfig {
\tconst adaptive = settings?.adaptiveTools;
\tconst requestedMode = parseEnum(
\t\tadaptive?.mode,
\t\tADAPTIVE_TOOLS_MODES,
\t\t"off",
\t);
\tconst unsupportedMode =
\t\trequestedMode === "adaptive" || requestedMode === "strict";
\tconst mode: AdaptiveToolsMode = unsupportedMode ? "observe" : requestedMode;
\tconst alwaysActive = normalizeNames(
\t\tadaptive?.alwaysActive,
\t\tDEFAULT_ALWAYS_ACTIVE,
\t);
\tconst groups = Object.create(null) as Record<string, string[]>;
\tif (adaptive?.groups && typeof adaptive.groups === "object") {
\t\tfor (const [rawGroup, tools] of Object.entries(adaptive.groups)) {
\t\t\tconst group = rawGroup.trim();
\t\t\tif (!group) continue;
\t\t\tgroups[group] = normalizeNames(tools);
\t\t}
\t}
\treturn {
\t\tmode,
\t\trequestedMode,
\t\talwaysActive,
\t\tgroups,
\t\tunsupportedMode,
\t};
}

export function loadZaiConfig(cwd = process.cwd()): ZaiConfig {
\tconst settings = readZaiSettingsSection(cwd);
\tconst telemetry = loadTelemetryConfig(settings);

\treturn {
\t\t// Undefined deliberately means no override: Pi currently emits
\t\t// clear_thinking=false for enabled native Z.AI thinking.
\t\tpreserveThinking: settings?.preserveThinking,
\t\tstatusTps: settings?.statusTps ?? true,
\t\tstatusTpsAvg: settings?.statusTpsAvg ?? false,
\t\tpromptStabilityMode: parseEnum(
\t\t\tsettings?.promptStability?.mode,
\t\t\tPROMPT_STABILITY_MODES,
\t\t\t"observe",
\t\t),
\t\tsessionAffinity: parseEnum(
\t\t\tsettings?.sessionAffinity,
\t\t\tSESSION_AFFINITY_MODES,
\t\t\t"off",
\t\t),
\t\tadaptiveTools: loadAdaptiveToolsConfig(settings),
\t\tmetrics: loadMetricsConfig(settings),
\t\ttelemetryMode: telemetry.mode,
\t\ttelemetryIngestUrl: telemetry.ingestUrl,
\t};
}
''',
)

write(
    "src/cache/toolset-snapshot.ts",
    '''import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
\tfingerprintToolset,
\ttype ToolFingerprintInput,
} from "./fingerprint.ts";

export type ToolsetTransitionClass =
\t| "unchanged"
\t| "tools-added"
\t| "tools-removed"
\t| "tool-schema-changed"
\t| "tool-description-changed"
\t| "toolset-reordered-only"
\t| "unknown-change";

export type ToolsetSnapshot = {
\tcount: number;
\tfingerprint: string;
\ttools: ToolFingerprintInput[];
};

export type ToolsetTransition = {
\tclassification: ToolsetTransitionClass;
\tpreviousCount: number;
\tnextCount: number;
\taddedCount: number;
\tremovedCount: number;
\tchanged: boolean;
};

function stableParams(value: unknown): string {
\tif (value === null || typeof value !== "object") {
\t\treturn JSON.stringify(value);
\t}
\tif (Array.isArray(value)) {
\t\treturn `[${value.map((item) => stableParams(item)).join(",")}]`;
\t}
\tconst entries = Object.entries(value as Record<string, unknown>).sort(
\t\t([left], [right]) => left.localeCompare(right),
\t);
\treturn `{${entries
\t\t.map(([key, val]) => `${JSON.stringify(key)}:${stableParams(val)}`)
\t\t.join(",")}}`;
}

function toolIdentityKey(tool: ToolFingerprintInput): string {
\treturn tool.name;
}

function toolContentKey(tool: ToolFingerprintInput): {
\tdescription: string;
\tparameters: string;
} {
\treturn {
\t\tdescription: tool.description ?? "",
\t\tparameters: stableParams(tool.parameters ?? null),
\t};
}

export function captureActiveToolset(
\tpi: ExtensionAPI,
): ToolsetSnapshot | undefined {
\ttry {
\t\tconst active = new Set(pi.getActiveTools());
\t\tconst tools = pi
\t\t\t.getAllTools()
\t\t\t.filter((tool) => active.has(tool.name))
\t\t\t.map((tool) => ({
\t\t\t\tname: tool.name,
\t\t\t\tdescription: tool.description,
\t\t\t\tparameters: tool.parameters,
\t\t\t}))
\t\t\t.sort((left, right) => left.name.localeCompare(right.name));
\t\treturn {
\t\t\tcount: tools.length,
\t\t\tfingerprint: fingerprintToolset(tools),
\t\t\ttools,
\t\t};
\t} catch {
\t\treturn undefined;
\t}
}

export function classifyToolsetTransition(
\tprevious: ToolsetSnapshot | undefined,
\tnext: ToolsetSnapshot,
): ToolsetTransition {
\tif (!previous) {
\t\treturn {
\t\t\tclassification: "unchanged",
\t\t\tpreviousCount: next.count,
\t\t\tnextCount: next.count,
\t\t\taddedCount: 0,
\t\t\tremovedCount: 0,
\t\t\tchanged: false,
\t\t};
\t}

\tif (previous.fingerprint === next.fingerprint) {
\t\treturn {
\t\t\tclassification: "unchanged",
\t\t\tpreviousCount: previous.count,
\t\t\tnextCount: next.count,
\t\t\taddedCount: 0,
\t\t\tremovedCount: 0,
\t\t\tchanged: false,
\t\t};
\t}

\tconst previousByName = new Map(
\t\tprevious.tools.map((tool) => [toolIdentityKey(tool), tool]),
\t);
\tconst nextByName = new Map(
\t\tnext.tools.map((tool) => [toolIdentityKey(tool), tool]),
\t);

\tlet addedCount = 0;
\tlet removedCount = 0;
\tlet schemaChanged = false;
\tlet descriptionChanged = false;

\tfor (const name of nextByName.keys()) {
\t\tif (!previousByName.has(name)) addedCount += 1;
\t}
\tfor (const name of previousByName.keys()) {
\t\tif (!nextByName.has(name)) removedCount += 1;
\t}

\tfor (const [name, nextTool] of nextByName) {
\t\tconst previousTool = previousByName.get(name);
\t\tif (!previousTool) continue;
\t\tconst prevContent = toolContentKey(previousTool);
\t\tconst nextContent = toolContentKey(nextTool);
\t\tif (prevContent.parameters !== nextContent.parameters) {
\t\t\tschemaChanged = true;
\t\t} else if (prevContent.description !== nextContent.description) {
\t\t\tdescriptionChanged = true;
\t\t}
\t}

\tconst sameNames =
\t\taddedCount === 0 &&
\t\tremovedCount === 0 &&
\t\tprevious.tools.length === next.tools.length;

\tlet classification: ToolsetTransitionClass;
\tif (sameNames && !schemaChanged && !descriptionChanged) {
\t\tclassification = "toolset-reordered-only";
\t} else if (
\t\taddedCount > 0 &&
\t\tremovedCount === 0 &&
\t\t!schemaChanged &&
\t\t!descriptionChanged
\t) {
\t\tclassification = "tools-added";
\t} else if (
\t\tremovedCount > 0 &&
\t\taddedCount === 0 &&
\t\t!schemaChanged &&
\t\t!descriptionChanged
\t) {
\t\tclassification = "tools-removed";
\t} else if (schemaChanged) {
\t\tclassification = "tool-schema-changed";
\t} else if (descriptionChanged) {
\t\tclassification = "tool-description-changed";
\t} else {
\t\tclassification = "unknown-change";
\t}

\tconst changed = classification !== "toolset-reordered-only";

\treturn {
\t\tclassification: changed ? classification : "unchanged",
\t\tpreviousCount: previous.count,
\t\tnextCount: next.count,
\t\taddedCount,
\t\tremovedCount,
\t\tchanged,
\t};
}
''',
)

replace_exact(
    "src/state.ts",
    'import { AttemptTracker } from "./attempt-tracker.ts";\n',
    'import type { AdaptiveToolObservation } from "./adaptive-tools/observe.ts";\nimport { AttemptTracker } from "./attempt-tracker.ts";\n',
)
replace_exact(
    "src/state.ts",
    '''\tadaptiveTools:
\t\t| {
\t\t\t\tmode: string;
\t\t\t\tloaderInvocations: number;
\t\t\t\tlastAddedCount: number;
\t\t  }
\t\t| undefined;
''',
    '''\tadaptiveTools:
\t\t| {
\t\t\t\tmode: string;
\t\t\t\tloaderInvocations: number;
\t\t\t\tlastAddedCount: number;
\t\t\t\tobservation?: AdaptiveToolObservation;
\t\t  }
\t\t| undefined;
''',
)

replace_exact(
    "src/index.ts",
    'import { applyAdaptiveToolsSessionPolicy } from "./adaptive-tools/index.ts";',
    '''import {
\tcreateAdaptiveToolsSessionPolicy,
} from "./adaptive-tools/index.ts";''',
)
replace_exact(
    "src/index.ts",
    '''\tconst snapshot = captureActiveToolset(pi);
\tconst transition = classifyToolsetTransition(
\t\tsessionState.lastToolsetSnapshot,
\t\tsnapshot,
\t);
''',
    '''\tconst snapshot = captureActiveToolset(pi);
\tif (!snapshot) return;
\tconst transition = classifyToolsetTransition(
\t\tsessionState.lastToolsetSnapshot,
\t\tsnapshot,
\t);
''',
)
replace_exact(
    "src/index.ts",
    '''\tif (transition.changed) {
\t\tsessionState.toolsetGeneration += 1;
\t\tupdateCacheSegment(model, systemPrompt, snapshot.fingerprint, [
\t\t\t`toolset:${transition.classification}`,
\t\t]);
\t} else if (!getCacheMetricsStore().get()?.segment) {
\t\tupdateCacheSegment(model, systemPrompt, snapshot.fingerprint);
\t} else {
\t\tupdateCacheSegment(model, systemPrompt, snapshot.fingerprint);
\t}
''',
    '''\tif (transition.changed) {
\t\tsessionState.toolsetGeneration += 1;
\t}
\tupdateCacheSegment(
\t\tmodel,
\t\tsystemPrompt,
\t\tsnapshot.fingerprint,
\t\ttransition.changed ? [`toolset:${transition.classification}`] : [],
\t);
''',
)
replace_exact(
    "src/index.ts",
    '''export default function piZaiExtension(pi: ExtensionAPI): void {
\tlet config: ZaiConfig = loadZaiConfig();

\tsessionState.preserveThinking = config.preserveThinking;
''',
    '''export default function piZaiExtension(pi: ExtensionAPI): void {
\tlet config: ZaiConfig = loadZaiConfig();
\tconst adaptiveToolsPolicy = createAdaptiveToolsSessionPolicy(
\t\tpi,
\t\t() => config.adaptiveTools,
\t);
\tconst syncAdaptiveToolsPolicy = (model: ZaiModel | undefined): void => {
\t\ttry {
\t\t\tif (isManagedZaiModel(model)) adaptiveToolsPolicy.apply();
\t\t\telse adaptiveToolsPolicy.restore();
\t\t} catch {
\t\t\t// Fail open: adaptive tooling must never block the Pi runtime.
\t\t}
\t};

\tsessionState.preserveThinking = config.preserveThinking;
''',
)
replace_exact(
    "src/index.ts",
    '''\t\tif (ctx.model && isManagedZaiModel(ctx.model)) {
\t\t\ttry {
\t\t\t\tapplyAdaptiveToolsSessionPolicy(pi, config.adaptiveTools);
\t\t\t} catch {
\t\t\t\t// Fail open: never block session start on adaptive tooling.
\t\t\t}
\t\t}
''',
    '''\t\tsyncAdaptiveToolsPolicy(ctx.model);
''',
)
replace_exact(
    "src/index.ts",
    '''\tpi.on("session_shutdown", async (_event, ctx) => {
\t\tresetCacheMetrics();
''',
    '''\tpi.on("session_shutdown", async (_event, ctx) => {
\t\tadaptiveToolsPolicy.restore();
\t\tresetCacheMetrics();
''',
)
replace_exact(
    "src/index.ts",
    '''\tpi.on("model_select", async (event, ctx) => {
\t\tclampThinkingForModel(pi, event.model);
\t\tupdateSessionFromModel(event.model, pi.getThinkingLevel());
''',
    '''\tpi.on("model_select", async (event, ctx) => {
\t\tsyncAdaptiveToolsPolicy(event.model);
\t\tclampThinkingForModel(pi, event.model);
\t\tupdateSessionFromModel(event.model, pi.getThinkingLevel());
''',
)
replace_exact(
    "src/index.ts",
    '''\t\t// Baseline only; authoritative toolset check happens in before_provider_request.
\t\tupdateCacheSegment(ctx.model, systemPromptForMetrics, snapshot.fingerprint);
\t\tsessionState.lastToolsetSnapshot = snapshot;
''',
    '''\t\t// Baseline only; authoritative toolset check happens in before_provider_request.
\t\tif (snapshot) {
\t\t\tupdateCacheSegment(ctx.model, systemPromptForMetrics, snapshot.fingerprint);
\t\t\tsessionState.lastToolsetSnapshot = snapshot;
\t\t}
''',
)
replace_exact(
    "src/index.ts",
    '''\t\ttry {
\t\t\tconst systemPrompt =
\t\t\t\tsessionState.promptStability !== undefined
\t\t\t\t\t? ctx.getSystemPrompt()
\t\t\t\t\t: ctx.getSystemPrompt();
\t\t\tsyncToolsetAtProviderBoundary(pi, ctx.model, systemPrompt);
''',
    '''\t\ttry {
\t\t\tsyncToolsetAtProviderBoundary(pi, ctx.model, ctx.getSystemPrompt());
''',
)
replace_exact(
    "src/index.ts",
    '''\t\tif (
\t\t\tconfig.sessionAffinity === "experimental" &&
\t\t\t!hasHeader("X-Session-Id") &&
\t\t\t!hasHeader("x-session-id")
\t\t) {
''',
    '''\t\tconst hasAffinityHeader = [
\t\t\t"x-session-id",
\t\t\t"session-id",
\t\t\t"session_id",
\t\t\t"x-client-request-id",
\t\t\t"x-session-affinity",
\t\t].some(hasHeader);
\t\tif (config.sessionAffinity === "experimental" && !hasAffinityHeader) {
''',
)

write(
    "src/commands/capabilities.ts",
    '''import {
\tchmodSync,
\tmkdirSync,
\treadFileSync,
\twriteFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import type { ProviderHeaders } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { resolveZaiCapabilities } from "../capabilities.ts";
import { EXTENSION_VERSION } from "../version.generated.ts";
import type { ZaiModel } from "../zai-model.ts";
import type { ZaiCommandDeps } from "./deps.ts";
import { formatHeading, formatKeyValue, joinCommandLines } from "./format.ts";
import { requireZaiModel } from "./helpers.ts";

const PI_PEER_FLOOR = "0.80.7";
const PROBE_TIMEOUT_MS = 10_000;

type ProbeSupport = boolean | "unknown";

type ProbeResult = {
\tname: string;
\tsupported: ProbeSupport;
\thttpStatus?: number;
\tdetail: string;
};

type ProbeCache = {
\textensionVersion: string;
\tpiPeerFloor: string;
\tprovider: string;
\tmodel: string;
\tendpoint: string;
\tresults: ProbeResult[];
\tupdatedAt: string;
};

type ProbeIdentity = Pick<
\tProbeCache,
\t"extensionVersion" | "piPeerFloor" | "provider" | "model" | "endpoint"
>;

function probeCachePath(): string {
\treturn join(getAgentDir(), "state", "pi-zai", "capabilities-probe.json");
}

function probeIdentity(model: ZaiModel): ProbeIdentity {
\treturn {
\t\textensionVersion: EXTENSION_VERSION,
\t\tpiPeerFloor: PI_PEER_FLOOR,
\t\tprovider: model.provider,
\t\tmodel: model.id,
\t\tendpoint: model.baseUrl,
\t};
}

function readProbeCache(expected: ProbeIdentity): ProbeCache | undefined {
\ttry {
\t\tconst parsed = JSON.parse(
\t\t\treadFileSync(probeCachePath(), "utf8"),
\t\t) as ProbeCache;
\t\tif (!parsed || typeof parsed !== "object") return undefined;
\t\tfor (const [key, value] of Object.entries(expected)) {
\t\t\tif (parsed[key as keyof ProbeIdentity] !== value) return undefined;
\t\t}
\t\treturn parsed;
\t} catch {
\t\treturn undefined;
\t}
}

function writeProbeCache(cache: ProbeCache): void {
\tconst path = probeCachePath();
\tmkdirSync(dirname(path), { recursive: true, mode: 0o700 });
\twriteFileSync(path, `${JSON.stringify(cache, null, 2)}\n`, {
\t\tencoding: "utf8",
\t\tmode: 0o600,
\t});
\tchmodSync(path, 0o600);
}

function normalizedHeaders(
\theaders: ProviderHeaders | undefined,
\tapiKey: string | undefined,
): Record<string, string> {
\tconst normalized: Record<string, string> = {};
\tfor (const [name, value] of Object.entries(headers ?? {})) {
\t\tif (typeof value === "string") normalized[name] = value;
\t}
\tconst hasAuthorization = Object.keys(normalized).some(
\t\t(name) => name.toLowerCase() === "authorization",
\t);
\tif (!hasAuthorization && apiKey) {
\t\tnormalized.Authorization = `Bearer ${apiKey}`;
\t}
\tnormalized["Content-Type"] = "application/json";
\tnormalized["User-Agent"] = `pi-zai/${EXTENSION_VERSION}`;
\treturn normalized;
}

function chatEndpoint(baseUrl: string): string {
\tconst normalized = baseUrl.replace(/\/$/, "");
\treturn normalized.endsWith("/chat/completions")
\t\t? normalized
\t\t: `${normalized}/chat/completions`;
}

async function runSyntheticProbe(
\tname: string,
\trunner: () => Promise<{
\t\tsupported: ProbeSupport;
\t\tstatus?: number;
\t\tdetail: string;
\t}>,
): Promise<ProbeResult> {
\ttry {
\t\tconst result = await runner();
\t\treturn {
\t\t\tname,
\t\t\tsupported: result.supported,
\t\t\thttpStatus: result.status,
\t\t\tdetail: result.detail,
\t\t};
\t} catch (error) {
\t\treturn {
\t\t\tname,
\t\t\tsupported: false,
\t\t\tdetail: error instanceof Error ? error.message : "probe failed",
\t\t};
\t}
}

async function postProbe(
\tendpoint: string,
\theaders: Record<string, string>,
\tbody: Record<string, unknown>,
): Promise<Response> {
\treturn fetch(endpoint, {
\t\tmethod: "POST",
\t\theaders,
\t\tbody: JSON.stringify(body),
\t\tsignal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
\t});
}

async function discardBody(response: Response): Promise<void> {
\ttry {
\t\tawait response.body?.cancel();
\t} catch {
\t\t// Response content is deliberately not retained by capability probes.
\t}
}

function formatSupport(value: ProbeSupport): string {
\tif (value === true) return "ok";
\tif (value === "unknown") return "unknown";
\treturn "no";
}

export function registerZaiCapabilitiesCommand(
\tpi: ExtensionAPI,
\tdeps: ZaiCommandDeps,
): void {
\tpi.registerCommand("zai-capabilities", {
\t\tdescription:
\t\t\t"Show Z.AI capability resolution and optional live probes (never automatic)",
\t\thandler: async (args, ctx) => {
\t\t\tconst check = requireZaiModel(ctx);
\t\t\tif ("error" in check) {
\t\t\t\tctx.ui.notify(check.error, "warning");
\t\t\t\treturn;
\t\t\t}

\t\t\tconst model = check.model;
\t\t\tconst config = deps.getConfig(ctx.cwd);
\t\t\tconst capabilities = resolveZaiCapabilities(
\t\t\t\tmodel,
\t\t\t\tconfig.sessionAffinity,
\t\t\t);
\t\t\tconst identity = probeIdentity(model);
\t\t\tconst sub = args.trim().split(/\s+/)[0]?.toLowerCase() || "status";

\t\t\tif (sub === "probe") {
\t\t\t\tconst confirmed = await ctx.ui.confirm(
\t\t\t\t\t"Live capability probes",
\t\t\t\t\t"Run four short synthetic Z.AI requests (may incur billing). Continue?",
\t\t\t\t);
\t\t\t\tif (!confirmed) {
\t\t\t\t\tctx.ui.notify("Capability probe cancelled.", "info");
\t\t\t\t\treturn;
\t\t\t\t}

\t\t\t\tconst auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
\t\t\t\tif (!auth.ok) {
\t\t\t\t\tctx.ui.notify(
\t\t\t\t\t\t"No credentials available for live probes on the active provider.",
\t\t\t\t\t\t"warning",
\t\t\t\t\t);
\t\t\t\t\treturn;
\t\t\t\t}
\t\t\t\tconst headers = normalizedHeaders(auth.headers, auth.apiKey);
\t\t\t\tif (
\t\t\t\t\t!Object.keys(headers).some(
\t\t\t\t\t\t(name) => name.toLowerCase() === "authorization",
\t\t\t\t\t)
\t\t\t\t) {
\t\t\t\t\tctx.ui.notify(
\t\t\t\t\t\t"Resolved credentials do not contain an authorization header.",
\t\t\t\t\t\t"warning",
\t\t\t\t\t);
\t\t\t\t\treturn;
\t\t\t\t}

\t\t\t\tconst endpoint = chatEndpoint(model.baseUrl);
\t\t\t\tconst syntheticTool = {
\t\t\t\t\ttype: "function",
\t\t\t\t\tfunction: {
\t\t\t\t\t\tname: "ping",
\t\t\t\t\t\tdescription: "Synthetic probe tool",
\t\t\t\t\t\tparameters: { type: "object", properties: {} },
\t\t\t\t\t},
\t\t\t\t};
\t\t\t\tconst results: ProbeResult[] = [];

\t\t\t\tresults.push(
\t\t\t\t\tawait runSyntheticProbe("tool_choice=auto", async () => {
\t\t\t\t\t\tconst response = await postProbe(endpoint, headers, {
\t\t\t\t\t\t\tmodel: model.id,
\t\t\t\t\t\t\tmessages: [{ role: "user", content: "Reply with OK" }],
\t\t\t\t\t\t\ttools: [syntheticTool],
\t\t\t\t\t\t\ttool_choice: "auto",
\t\t\t\t\t\t\tmax_tokens: 8,
\t\t\t\t\t\t});
\t\t\t\t\t\tawait discardBody(response);
\t\t\t\t\t\treturn {
\t\t\t\t\t\t\tsupported: response.ok,
\t\t\t\t\t\t\tstatus: response.status,
\t\t\t\t\t\t\tdetail: response.ok
\t\t\t\t\t\t\t\t? "accepted"
\t\t\t\t\t\t\t\t: `rejected with HTTP ${response.status}`,
\t\t\t\t\t\t};
\t\t\t\t\t}),
\t\t\t\t);

\t\t\t\tfor (const choice of ["none", "required"] as const) {
\t\t\t\t\tresults.push(
\t\t\t\t\t\tawait runSyntheticProbe(`tool_choice=${choice}`, async () => {
\t\t\t\t\t\t\tconst response = await postProbe(endpoint, headers, {
\t\t\t\t\t\t\t\tmodel: model.id,
\t\t\t\t\t\t\t\tmessages: [{ role: "user", content: "Reply with OK" }],
\t\t\t\t\t\t\t\ttools: [syntheticTool],
\t\t\t\t\t\t\t\ttool_choice: choice,
\t\t\t\t\t\t\t\tmax_tokens: 8,
\t\t\t\t\t\t\t});
\t\t\t\t\t\t\tawait discardBody(response);
\t\t\t\t\t\t\treturn {
\t\t\t\t\t\t\t\tsupported: response.ok ? "unknown" : false,
\t\t\t\t\t\t\t\tstatus: response.status,
\t\t\t\t\t\t\t\tdetail: response.ok
\t\t\t\t\t\t\t\t\t? "accepted; semantic obedience not verified"
\t\t\t\t\t\t\t\t\t: `rejected with HTTP ${response.status}`,
\t\t\t\t\t\t\t};
\t\t\t\t\t\t}),
\t\t\t\t\t);
\t\t\t\t}

\t\t\t\tresults.push(
\t\t\t\t\tawait runSyntheticProbe("tool_stream=true", async () => {
\t\t\t\t\t\tconst response = await postProbe(endpoint, headers, {
\t\t\t\t\t\t\tmodel: model.id,
\t\t\t\t\t\t\tmessages: [{ role: "user", content: "Call ping" }],
\t\t\t\t\t\t\ttools: [syntheticTool],
\t\t\t\t\t\t\ttool_choice: "auto",
\t\t\t\t\t\t\tstream: true,
\t\t\t\t\t\t\ttool_stream: true,
\t\t\t\t\t\t\tmax_tokens: 8,
\t\t\t\t\t\t});
\t\t\t\t\t\tawait discardBody(response);
\t\t\t\t\t\treturn {
\t\t\t\t\t\t\tsupported: response.ok,
\t\t\t\t\t\t\tstatus: response.status,
\t\t\t\t\t\t\tdetail: response.ok
\t\t\t\t\t\t\t\t? "accepted; streamed tool delta content not retained"
\t\t\t\t\t\t\t\t: `rejected with HTTP ${response.status}`,
\t\t\t\t\t\t};
\t\t\t\t\t}),
\t\t\t\t);

\t\t\t\tconst cache: ProbeCache = {
\t\t\t\t\t...identity,
\t\t\t\t\tresults,
\t\t\t\t\tupdatedAt: new Date().toISOString(),
\t\t\t\t};
\t\t\t\twriteProbeCache(cache);

\t\t\t\tconst lines = [
\t\t\t\t\t...formatHeading("Z.AI capability probes"),
\t\t\t\t\t...results.map(
\t\t\t\t\t\t(result) =>
\t\t\t\t\t\t\t`${result.name}: ${formatSupport(result.supported)} (${result.detail})`,
\t\t\t\t\t),
\t\t\t\t\t"Stored locally as status metadata only (no response bodies).",
\t\t\t\t];
\t\t\t\tctx.ui.notify(joinCommandLines(lines), "info");
\t\t\t\treturn;
\t\t\t}

\t\t\tconst cache = readProbeCache(identity);
\t\t\tconst lines = [
\t\t\t\t...formatHeading("Z.AI capabilities"),
\t\t\t\tformatKeyValue("Extension", deps.extensionVersion),
\t\t\t\tformatKeyValue("Provider ownership", capabilities.providerOwnership),
\t\t\t\tformatKeyValue("API family", capabilities.apiFamily),
\t\t\t\tformatKeyValue(
\t\t\t\t\t"Thinking format",
\t\t\t\t\tcapabilities.usesZaiThinkingFormat ? "zai" : "other/unknown",
\t\t\t\t),
\t\t\t\tformatKeyValue(
\t\t\t\t\t"Tool stream metadata",
\t\t\t\t\tcapabilities.streamsToolCalls ? "yes" : "no",
\t\t\t\t),
\t\t\t\tformatKeyValue("Dynamic tools", capabilities.dynamicToolMode),
\t\t\t\tformatKeyValue(
\t\t\t\t\t"Tool choice API support",
\t\t\t\t\tcapabilities.toolChoiceSupportedByApi
\t\t\t\t\t\t? "Responses-family yes"
\t\t\t\t\t\t: "not claimed for this API",
\t\t\t\t),
\t\t\t\tformatKeyValue("Affinity source", capabilities.sessionAffinitySource),
\t\t\t\tformatKeyValue(
\t\t\t\t\t"Adaptive tools",
\t\t\t\t\tconfig.adaptiveTools.unsupportedMode
\t\t\t\t\t\t? `${config.adaptiveTools.requestedMode} → observe (unsupported in 0.5.0)`
\t\t\t\t\t\t: config.adaptiveTools.mode,
\t\t\t\t),
\t\t\t\tformatKeyValue(
\t\t\t\t\t"Last probe cache",
\t\t\t\t\tcache
\t\t\t\t\t\t? `${cache.updatedAt} (${cache.results.length} results)`
\t\t\t\t\t\t: "none for this provider/model/endpoint",
\t\t\t\t),
\t\t\t\t"",
\t\t\t\t"Use /zai-capabilities probe to run opt-in live checks.",
\t\t\t];
\t\t\tctx.ui.notify(joinCommandLines(lines), "info");
\t\t},
\t});
}
''',
)

replace_exact(
    "src/commands/status.ts",
    '''\t\t\t\tformatKeyValue("Adaptive tools", config.adaptiveTools.mode),
''',
    '''\t\t\t\tformatKeyValue(
\t\t\t\t\t"Adaptive tools",
\t\t\t\t\tconfig.adaptiveTools.unsupportedMode
\t\t\t\t\t\t? `${config.adaptiveTools.requestedMode} → observe`
\t\t\t\t\t\t: config.adaptiveTools.mode,
\t\t\t\t),
\t\t\t\tformatKeyValue(
\t\t\t\t\t"Adaptive observation",
\t\t\t\t\tsessionState.adaptiveTools?.observation
\t\t\t\t\t\t? `${sessionState.adaptiveTools.observation.deferredCount} configured active tools; ~${sessionState.adaptiveTools.observation.estimatedDeferredSchemaBytes} schema bytes`
\t\t\t\t\t\t: "none",
\t\t\t\t),
''',
)

replace_exact(
    "src/commands/doctor.ts",
    '"Requires @earendil-works/pi-coding-agent >= 0.80.0 with native Z.AI transport.",',
    '"Requires @earendil-works/pi-coding-agent >= 0.80.7 with native Z.AI transport.",',
)
replace_exact(
    "src/commands/doctor.ts",
    '''\t\t\tchecks.push({
\t\t\t\tname: "Pi compatibility",
\t\t\t\tstatus: "pass",
\t\t\t\tdetail: `API ${capabilities.apiFamily}; dynamic tools ${capabilities.dynamicToolMode}; ownership ${capabilities.providerOwnership}`,
\t\t\t});
''',
    '''\t\t\tchecks.push({
\t\t\t\tname: "Provider capabilities",
\t\t\t\tstatus: "pass",
\t\t\t\tdetail: `API ${capabilities.apiFamily}; dynamic tools ${capabilities.dynamicToolMode}; ownership ${capabilities.providerOwnership}`,
\t\t\t});
''',
)
replace_exact(
    "src/commands/doctor.ts",
    '''\t\t\t\tdetail: config.adaptiveTools.unsupportedMode
\t\t\t\t\t? `mode ${config.adaptiveTools.mode} requested but unsupported in 0.5.0; using observe`
\t\t\t\t\t: `mode ${config.adaptiveTools.mode}`,
''',
    '''\t\t\t\tdetail: config.adaptiveTools.unsupportedMode
\t\t\t\t\t? `mode ${config.adaptiveTools.requestedMode} requested but unsupported in 0.5.0; using observe`
\t\t\t\t\t: `mode ${config.adaptiveTools.mode}`,
''',
)

write(
    "src/config.test.ts",
    '''import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CONFIG_DIR_NAME } from "@earendil-works/pi-coding-agent";
import { afterEach, describe, expect, it } from "vitest";
import { loadZaiConfig } from "./config.ts";

const temporaryDirectories: string[] = [];

afterEach(() => {
\tfor (const directory of temporaryDirectories.splice(0)) {
\t\trmSync(directory, { recursive: true, force: true });
\t}
});

function writeConfig(value: unknown): string {
\tconst cwd = mkdtempSync(join(tmpdir(), "pi-zai-config-"));
\ttemporaryDirectories.push(cwd);
\tmkdirSync(join(cwd, CONFIG_DIR_NAME), { recursive: true });
\twriteFileSync(
\t\tjoin(cwd, CONFIG_DIR_NAME, "settings.json"),
\t\tJSON.stringify(value),
\t);
\treturn cwd;
}

describe("loadZaiConfig", () => {
\tit("defaults remote telemetry and adaptive tools to off", () => {
\t\texpect(loadZaiConfig("/tmp")).toMatchObject({
\t\t\ttelemetryMode: "off",
\t\t\tadaptiveTools: { mode: "off", requestedMode: "off" },
\t\t});
\t});

\tit("falls unsupported adaptive/strict modes back to observe", () => {
\t\tconst cwd = writeConfig({
\t\t\tzai: { adaptiveTools: { mode: "adaptive", groups: { git: ["bash"] } } },
\t\t});
\t\tconst config = loadZaiConfig(cwd);
\t\texpect(config.adaptiveTools.mode).toBe("observe");
\t\texpect(config.adaptiveTools.requestedMode).toBe("adaptive");
\t\texpect(config.adaptiveTools.unsupportedMode).toBe(true);
\t\texpect(config.adaptiveTools.groups.git).toEqual(["bash"]);
\t});

\tit("trims and deduplicates tool names without prototype pollution", () => {
\t\tconst cwd = writeConfig({
\t\t\tzai: {
\t\t\t\tadaptiveTools: {
\t\t\t\t\tmode: "manual",
\t\t\t\t\talwaysActive: [" read ", "read", ""],
\t\t\t\t\tgroups: {
\t\t\t\t\t\t" shell ": [" bash ", "bash", ""],
\t\t\t\t\t\t"": ["write"],
\t\t\t\t\t\t"__proto__": ["edit"],
\t\t\t\t\t},
\t\t\t\t},
\t\t\t},
\t\t});
\t\tconst adaptive = loadZaiConfig(cwd).adaptiveTools;
\t\texpect(adaptive.alwaysActive).toEqual(["read"]);
\t\texpect(adaptive.groups.shell).toEqual(["bash"]);
\t\texpect(adaptive.groups["__proto__"]).toEqual(["edit"]);
\t\texpect(Object.getPrototypeOf(adaptive.groups)).toBeNull();
\t});
});
''',
)

replace_exact(
    "test/mock-extension-api.ts",
    '''\tcommandCalls: RegisteredCommand[];
};
''',
    '''\tcommandCalls: RegisteredCommand[];
\texecuteTool(name: string, params?: Record<string, unknown>): Promise<unknown>;
};
''',
)
replace_exact(
    "test/mock-extension-api.ts",
    '''\tconst registeredTools: Array<{
\t\tname: string;
\t\tdescription?: string;
\t\tparameters?: unknown;
\t}> = [];
''',
    '''\tconst registeredTools: Array<{
\t\tname: string;
\t\tdescription?: string;
\t\tparameters?: unknown;
\t\texecute?: (
\t\t\ttoolCallId: string,
\t\t\tparams: Record<string, unknown>,
\t\t) => Promise<unknown> | unknown;
\t}> = [];
''',
)
replace_exact(
    "test/mock-extension-api.ts",
    '''\t\tregisterTool(definition: {
\t\t\tname: string;
\t\t\tdescription?: string;
\t\t\tparameters?: unknown;
\t\t}) {
''',
    '''\t\tregisterTool(definition: {
\t\t\tname: string;
\t\t\tdescription?: string;
\t\t\tparameters?: unknown;
\t\t\texecute?: (
\t\t\t\ttoolCallId: string,
\t\t\t\tparams: Record<string, unknown>,
\t\t\t) => Promise<unknown> | unknown;
\t\t}) {
''',
)
replace_exact(
    "test/mock-extension-api.ts",
    '''\t\t\t\tparameters: definition.parameters,
\t\t\t});
''',
    '''\t\t\t\tparameters: definition.parameters,
\t\t\t\texecute: definition.execute,
\t\t\t});
''',
)
replace_exact(
    "test/mock-extension-api.ts",
    '''\treturn Object.assign(pi, {
\t\tproviderCalls,
\t\tcommandCalls,
\t\ttrigger: pi.trigger.bind(pi),
\t}) as unknown as MockExtensionApi;
''',
    '''\treturn Object.assign(pi, {
\t\tproviderCalls,
\t\tcommandCalls,
\t\ttrigger: pi.trigger.bind(pi),
\t\tasync executeTool(name: string, params: Record<string, unknown> = {}) {
\t\t\tconst tool = registeredTools.find((candidate) => candidate.name === name);
\t\t\tif (!tool?.execute) throw new Error(`Tool ${name} is not executable`);
\t\t\treturn tool.execute("test-tool-call", params);
\t\t},
\t}) as unknown as MockExtensionApi;
''',
)

write(
    "src/adaptive-tools/loader.integration.test.ts",
    '''import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CONFIG_DIR_NAME } from "@earendil-works/pi-coding-agent";
import { afterEach, describe, expect, it } from "vitest";
import {
\tcreateExtensionContext,
\tcreateMockExtensionApi,
\tcreateZaiModel,
} from "../../test/mock-extension-api.ts";
import piZaiExtension from "../index.ts";
import { getCacheMetricsStore, sessionState } from "../state.ts";
import type { ZaiModel } from "../zai-model.ts";

const temporaryDirectories: string[] = [];

afterEach(() => {
\tfor (const directory of temporaryDirectories.splice(0)) {
\t\trmSync(directory, { recursive: true, force: true });
\t}
});

function tempCwd(mode: string = "manual"): string {
\tconst directory = mkdtempSync(join(tmpdir(), "pi-zai-adaptive-"));
\ttemporaryDirectories.push(directory);
\tmkdirSync(join(directory, CONFIG_DIR_NAME), { recursive: true });
\twriteFileSync(
\t\tjoin(directory, CONFIG_DIR_NAME, "settings.json"),
\t\tJSON.stringify({
\t\t\tzai: {
\t\t\t\tadaptiveTools: {
\t\t\t\t\tmode,
\t\t\t\t\talwaysActive: ["read", "grep", "find", "ls", "zai_load_tools"],
\t\t\t\t\tgroups: { shell: ["bash"] },
\t\t\t\t},
\t\t\t\tmetrics: { mode: "memory" },
\t\t\t},
\t\t}),
\t);
\treturn directory;
}

function nonZaiModel(): ZaiModel {
\treturn { ...createZaiModel(), provider: "openai" };
}

describe("adaptive loader integration", () => {
\tit("loads a configured group and rotates the next cache segment once", async () => {
\t\tconst cwd = tempCwd();
\t\tconst pi = createMockExtensionApi({ cwd, model: createZaiModel() });
\t\tpiZaiExtension(pi);
\t\tconst ctx = createExtensionContext(cwd);

\t\tawait pi.trigger(
\t\t\t"session_start",
\t\t\t{ type: "session_start", reason: "startup" },
\t\t\tctx,
\t\t);
\t\texpect(pi.getActiveTools()).toContain("zai_load_tools");
\t\texpect(pi.getActiveTools()).not.toContain("bash");

\t\tawait pi.trigger(
\t\t\t"before_agent_start",
\t\t\t{ type: "before_agent_start", systemPrompt: "stable system prompt" },
\t\t\tctx,
\t\t);
\t\tawait pi.trigger(
\t\t\t"before_provider_request",
\t\t\t{
\t\t\t\ttype: "before_provider_request",
\t\t\t\tpayload: { thinking: { type: "enabled", clear_thinking: false } },
\t\t\t},
\t\t\tctx,
\t\t);
\t\tconst firstFingerprint =
\t\t\tgetCacheMetricsStore().get()?.segment.toolsetFingerprint;

\t\tawait pi.executeTool("zai_load_tools", { group: "shell" });
\t\texpect(pi.getActiveTools()).toContain("bash");
\t\tawait pi.trigger(
\t\t\t"before_provider_request",
\t\t\t{
\t\t\t\ttype: "before_provider_request",
\t\t\t\tpayload: { thinking: { type: "enabled", clear_thinking: false } },
\t\t\t},
\t\t\tctx,
\t\t);

\t\tconst secondFingerprint =
\t\t\tgetCacheMetricsStore().get()?.segment.toolsetFingerprint;
\t\texpect(secondFingerprint).not.toBe(firstFingerprint);
\t\texpect(sessionState.lastToolsetTransition?.classification).toBe(
\t\t\t"tools-added",
\t\t);
\t\tconst generation = sessionState.toolsetGeneration;
\t\tawait pi.trigger(
\t\t\t"before_provider_request",
\t\t\t{
\t\t\t\ttype: "before_provider_request",
\t\t\t\tpayload: { thinking: { type: "enabled", clear_thinking: false } },
\t\t\t},
\t\t\tctx,
\t\t);
\t\texpect(sessionState.toolsetGeneration).toBe(generation);
\t});

\tit("keeps every ungrouped tool active instead of applying a silent cap", async () => {
\t\tconst cwd = tempCwd();
\t\tconst pi = createMockExtensionApi({ cwd, model: createZaiModel() });
\t\tconst ungrouped = Array.from({ length: 20 }, (_, index) => `foreign-${index}`);
\t\tpi.setActiveTools([...pi.getActiveTools(), ...ungrouped]);
\t\tpiZaiExtension(pi);
\t\tawait pi.trigger(
\t\t\t"session_start",
\t\t\t{ type: "session_start", reason: "startup" },
\t\t\tcreateExtensionContext(cwd),
\t\t);
\t\tfor (const name of ungrouped) expect(pi.getActiveTools()).toContain(name);
\t});

\tit("applies on Z.AI model selection and restores controlled tools when leaving", async () => {
\t\tconst cwd = tempCwd();
\t\tconst initial = nonZaiModel();
\t\tconst pi = createMockExtensionApi({ cwd, model: initial });
\t\tpiZaiExtension(pi);
\t\tconst ctx = createExtensionContext(cwd, initial);
\t\tawait pi.trigger(
\t\t\t"session_start",
\t\t\t{ type: "session_start", reason: "startup" },
\t\t\tctx,
\t\t);
\t\texpect(pi.getActiveTools()).toContain("bash");

\t\tawait pi.trigger(
\t\t\t"model_select",
\t\t\t{
\t\t\t\ttype: "model_select",
\t\t\t\tmodel: createZaiModel(),
\t\t\t\tpreviousModel: initial,
\t\t\t\tsource: "set",
\t\t\t},
\t\t\tctx,
\t\t);
\t\texpect(pi.getActiveTools()).not.toContain("bash");
\t\texpect(pi.getActiveTools()).toContain("zai_load_tools");

\t\tawait pi.trigger(
\t\t\t"model_select",
\t\t\t{
\t\t\t\ttype: "model_select",
\t\t\t\tmodel: initial,
\t\t\t\tpreviousModel: createZaiModel(),
\t\t\t\tsource: "set",
\t\t\t},
\t\t\tctx,
\t\t);
\t\texpect(pi.getActiveTools()).toContain("bash");
\t\texpect(pi.getActiveTools()).not.toContain("zai_load_tools");
\t});

\tit("records useful observations without changing tools", async () => {
\t\tconst cwd = tempCwd("observe");
\t\tconst pi = createMockExtensionApi({ cwd, model: createZaiModel() });
\t\tconst before = [...pi.getActiveTools()];
\t\tpiZaiExtension(pi);
\t\tawait pi.trigger(
\t\t\t"session_start",
\t\t\t{ type: "session_start", reason: "startup" },
\t\t\tcreateExtensionContext(cwd),
\t\t);
\t\texpect(pi.getActiveTools()).toEqual(before);
\t\texpect(sessionState.adaptiveTools?.observation).toMatchObject({
\t\t\tdeferredCount: 1,
\t\t\tconfiguredGroupCount: 1,
\t\t});
\t});
});
''',
)

replace_exact(
    "src/cache/toolset-snapshot.test.ts",
    'import { describe, expect, it } from "vitest";\n',
    'import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";\nimport { describe, expect, it } from "vitest";\n',
)
replace_exact(
    "src/cache/toolset-snapshot.test.ts",
    '''import {
\tclassifyToolsetTransition,
\ttype ToolsetSnapshot,
} from "./toolset-snapshot.ts";
''',
    '''import {
\tcaptureActiveToolset,
\tclassifyToolsetTransition,
\ttype ToolsetSnapshot,
} from "./toolset-snapshot.ts";
''',
)
replace_exact(
    "src/cache/toolset-snapshot.test.ts",
    '''describe("classifyToolsetTransition", () => {
''',
    '''describe("classifyToolsetTransition", () => {
\tit("fails open when Pi tool enumeration throws", () => {
\t\tconst pi = {
\t\t\tgetActiveTools: () => {
\t\t\t\tthrow new Error("temporary runtime failure");
\t\t\t},
\t\t} as unknown as ExtensionAPI;
\t\texpect(captureActiveToolset(pi)).toBeUndefined();
\t});

''',
)

replace_exact(
    "docs/configuration.md",
    '''    "adaptiveTools": {
      "mode": "off",
      "maxInitialTools": 8,
      "stickyLoadedTools": true,
      "alwaysActive": ["read", "grep", "find", "ls", "zai_load_tools"],
      "groups": {}
    },
''',
    '''    "adaptiveTools": {
      "mode": "off",
      "alwaysActive": ["read", "grep", "find", "ls", "zai_load_tools"],
      "groups": {}
    },
''',
)
replace_exact(
    "docs/configuration.md",
    '''- Grouped tools are deactivated at session start only when `manual` is enabled; tools owned by other extensions and ungrouped builtins stay available.
- Lazy activation is additive. Z.AI still receives the full active tool list on the next request (Pi full-list fallback), and pi-zai rotates the cache segment once.
''',
    '''- Grouped tools are deactivated only while a managed Z.AI model is active in `manual` mode; switching away restores the controlled tool state.
- Tools owned by other extensions and ungrouped builtins are never capped or removed.
- Lazy activation is additive. Z.AI still receives the full active tool list on the next request (Pi full-list fallback), and pi-zai rotates the cache segment once.
- `observe` records the configured tool count and estimated schema bytes without registering a loader or changing active tools.
''',
)

write(
    "biome.json",
    '''{
\t"$schema": "https://biomejs.dev/schemas/2.0.6/schema.json",
\t"vcs": {
\t\t"enabled": true,
\t\t"clientKind": "git",
\t\t"useIgnoreFile": true
\t},
\t"files": {
\t\t"includes": [
\t\t\t"**",
\t\t\t"!**/dist/**",
\t\t\t"!**/node_modules/**",
\t\t\t"!**/worker/telemetry/node_modules/**"
\t\t]
\t},
\t"formatter": {
\t\t"enabled": true,
\t\t"indentStyle": "tab"
\t},
\t"linter": {
\t\t"enabled": true,
\t\t"rules": {
\t\t\t"recommended": true,
\t\t\t"style": {
\t\t\t\t"noParameterAssign": "error",
\t\t\t\t"useAsConstAssertion": "error",
\t\t\t\t"useDefaultParameterLast": "error",
\t\t\t\t"useEnumInitializers": "error",
\t\t\t\t"useSelfClosingElements": "error",
\t\t\t\t"useSingleVarDeclarator": "error",
\t\t\t\t"noUnusedTemplateLiteral": "error",
\t\t\t\t"useNumberNamespace": "error",
\t\t\t\t"noInferrableTypes": "error",
\t\t\t\t"noUselessElse": "error"
\t\t\t}
\t\t}
\t},
\t"javascript": {
\t\t"formatter": {
\t\t\t"quoteStyle": "double"
\t\t}
\t}
}
''',
)

# The runner must not remain in the feature branch.
Path("scripts/apply-pr23-review-fixes.py").unlink()
Path(".github/workflows/pr23-review-fix.yml").unlink()
