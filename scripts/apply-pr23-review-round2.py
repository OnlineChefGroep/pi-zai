from pathlib import Path


def write(path: str, content: str) -> None:
    Path(path).write_text(content.rstrip() + "\n", encoding="utf-8")


def replace_exact(path: str, before: str, after: str) -> None:
    file = Path(path)
    content = file.read_text(encoding="utf-8")
    if before not in content:
        raise RuntimeError(f"Expected block not found in {path}: {before[:160]!r}")
    file.write_text(content.replace(before, after, 1), encoding="utf-8")


write(
    "src/cache/fingerprint.ts",
    '''import { createHash } from "node:crypto";

export const SHORT_HASH_LENGTH = 16;

const TIMESTAMP_PATTERNS = [
\t/\\b\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:\\d{2})\\b/g,
\t/\\bCurrent time:.*$/gm,
\t/\\bLast updated:.*$/gm,
\t/\\bToken count: \\d+\\b/g,
\t/\\bContext tokens: \\d+\\b/g,
];

const GIT_STATUS_PATTERNS = [
\t/^Current git status\\b.*$/gm,
\t/^## (?:modified|untracked|staged).*/gm,
\t/^On branch .+$/gm,
\t/^Changes (?:not staged|to be committed).*/gm,
];

export function shortenHash(hex: string, length = SHORT_HASH_LENGTH): string {
\treturn hex.slice(0, length);
}

export function hashCanonicalText(text: string): string {
\treturn shortenHash(createHash("sha256").update(text).digest("hex"));
}

/** Strip volatile lines and normalize whitespace before fingerprinting. */
export function canonicalizeStablePrefix(text: string): string {
\tlet normalized = text.replace(/\\r\\n/g, "\\n").trim();
\tfor (const pattern of TIMESTAMP_PATTERNS) {
\t\tnormalized = normalized.replace(pattern, "");
\t}
\tfor (const pattern of GIT_STATUS_PATTERNS) {
\t\tnormalized = normalized.replace(pattern, "");
\t}
\treturn normalized.replace(/\\n{2,}/g, "\\n").trim();
}

export function fingerprintText(text: string): string {
\treturn hashCanonicalText(canonicalizeStablePrefix(text));
}

export function fingerprintSystemPrompt(systemPrompt: string): string {
\treturn fingerprintText(systemPrompt);
}

export type ToolFingerprintInput = {
\tname: string;
\tdescription?: string;
\tparameters?: unknown;
};

export type CanonicalToolFingerprint = {
\tname: string;
\tdescription: string;
\tparameters: string;
\tcanonical: string;
};

function stableJson(value: unknown): string {
\tif (value === null || typeof value !== "object") {
\t\treturn JSON.stringify(value);
\t}
\tif (Array.isArray(value)) {
\t\treturn `[${value.map((item) => stableJson(item)).join(",")}]`;
\t}
\tconst entries = Object.entries(value as Record<string, unknown>).sort(
\t\t([a], [b]) => a.localeCompare(b),
\t);
\treturn `{${entries.map(([key, val]) => `${JSON.stringify(key)}:${stableJson(val)}`).join(",")}}`;
}

export function canonicalizeToolParts(
\ttool: ToolFingerprintInput,
): CanonicalToolFingerprint {
\tconst description = tool.description ?? "";
\tconst parameters =
\t\ttool.parameters && typeof tool.parameters === "object"
\t\t\t? stableJson(tool.parameters)
\t\t\t: String(tool.parameters ?? "");
\treturn {
\t\tname: tool.name,
\t\tdescription,
\t\tparameters,
\t\tcanonical: `${tool.name}\\n${description}\\n${parameters}`,
\t};
}

export function canonicalizeTool(tool: ToolFingerprintInput): string {
\treturn canonicalizeToolParts(tool).canonical;
}

export function fingerprintCanonicalToolset(
\ttools: Pick<CanonicalToolFingerprint, "canonical">[],
): string {
\tconst canonical = tools
\t\t.map((tool) => tool.canonical)
\t\t.sort((a, b) => a.localeCompare(b))
\t\t.join("\\n---\\n");
\treturn hashCanonicalText(canonical);
}

export function fingerprintToolset(tools: ToolFingerprintInput[]): string {
\treturn fingerprintCanonicalToolset(tools.map(canonicalizeToolParts));
}
''',
)

write(
    "src/cache/toolset-snapshot.ts",
    '''import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import {
\tcanonicalizeToolParts,
\tfingerprintCanonicalToolset,
\ttype CanonicalToolFingerprint,
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
\ttools: CanonicalToolFingerprint[];
};

export type ToolsetTransition = {
\tclassification: ToolsetTransitionClass;
\tpreviousCount: number;
\tnextCount: number;
\taddedCount: number;
\tremovedCount: number;
\tchanged: boolean;
};

export function captureActiveToolset(
\tpi: ExtensionAPI,
): ToolsetSnapshot | undefined {
\ttry {
\t\tconst active = new Set(pi.getActiveTools());
\t\tconst tools = pi
\t\t\t.getAllTools()
\t\t\t.filter((tool) => active.has(tool.name))
\t\t\t.map((tool) =>
\t\t\t\tcanonicalizeToolParts({
\t\t\t\t\tname: tool.name,
\t\t\t\t\tdescription: tool.description,
\t\t\t\t\tparameters: tool.parameters,
\t\t\t\t}),
\t\t\t)
\t\t\t.sort((left, right) => left.name.localeCompare(right.name));
\t\treturn {
\t\t\tcount: tools.length,
\t\t\tfingerprint: fingerprintCanonicalToolset(tools),
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
\t\tprevious.tools.map((tool) => [tool.name, tool]),
\t);
\tconst nextByName = new Map(next.tools.map((tool) => [tool.name, tool]));

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
\t\tif (previousTool.parameters !== nextTool.parameters) {
\t\t\tschemaChanged = true;
\t\t} else if (previousTool.description !== nextTool.description) {
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

write(
    "src/cache/toolset-snapshot.test.ts",
    '''import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import {
\tcanonicalizeToolParts,
\tfingerprintCanonicalToolset,
\ttype ToolFingerprintInput,
} from "./fingerprint.ts";
import {
\tcaptureActiveToolset,
\tclassifyToolsetTransition,
\ttype ToolsetSnapshot,
} from "./toolset-snapshot.ts";

function snap(inputs: ToolFingerprintInput[]): ToolsetSnapshot {
\tconst tools = inputs
\t\t.map(canonicalizeToolParts)
\t\t.sort((a, b) => a.name.localeCompare(b.name));
\treturn {
\t\tcount: tools.length,
\t\tfingerprint: fingerprintCanonicalToolset(tools),
\t\ttools,
\t};
}

describe("classifyToolsetTransition", () => {
\tit("fails open when Pi tool enumeration throws", () => {
\t\tconst pi = {
\t\t\tgetActiveTools: () => {
\t\t\t\tthrow new Error("temporary runtime failure");
\t\t\t},
\t\t} as unknown as ExtensionAPI;
\t\texpect(captureActiveToolset(pi)).toBeUndefined();
\t});

\tit("keeps stable toolsets unchanged", () => {
\t\tconst previous = snap([
\t\t\t{ name: "read", description: "Read", parameters: { type: "object" } },
\t\t]);
\t\tconst next = snap([
\t\t\t{ name: "read", description: "Read", parameters: { type: "object" } },
\t\t]);
\t\texpect(classifyToolsetTransition(previous, next).classification).toBe(
\t\t\t"unchanged",
\t\t);
\t});

\tit("classifies additive tool activation", () => {
\t\tconst previous = snap([{ name: "read", description: "Read" }]);
\t\tconst next = snap([
\t\t\t{ name: "read", description: "Read" },
\t\t\t{ name: "bash", description: "Shell" },
\t\t]);
\t\tconst transition = classifyToolsetTransition(previous, next);
\t\texpect(transition.classification).toBe("tools-added");
\t\texpect(transition.addedCount).toBe(1);
\t\texpect(transition.changed).toBe(true);
\t});

\tit("classifies removals", () => {
\t\tconst previous = snap([
\t\t\t{ name: "read", description: "Read" },
\t\t\t{ name: "bash", description: "Shell" },
\t\t]);
\t\tconst next = snap([{ name: "read", description: "Read" }]);
\t\texpect(classifyToolsetTransition(previous, next).classification).toBe(
\t\t\t"tools-removed",
\t\t);
\t});

\tit("classifies schema changes under the same name", () => {
\t\tconst previous = snap([
\t\t\t{
\t\t\t\tname: "read",
\t\t\t\tdescription: "Read",
\t\t\t\tparameters: {
\t\t\t\t\ttype: "object",
\t\t\t\t\tproperties: { path: { type: "string" } },
\t\t\t\t},
\t\t\t},
\t\t]);
\t\tconst next = snap([
\t\t\t{
\t\t\t\tname: "read",
\t\t\t\tdescription: "Read",
\t\t\t\tparameters: {
\t\t\t\t\ttype: "object",
\t\t\t\t\tproperties: { path: { type: "string" }, offset: { type: "number" } },
\t\t\t\t},
\t\t\t},
\t\t]);
\t\texpect(classifyToolsetTransition(previous, next).classification).toBe(
\t\t\t"tool-schema-changed",
\t\t);
\t});

\tit("treats object-key reordering as unchanged", () => {
\t\tconst previous = snap([
\t\t\t{
\t\t\t\tname: "read",
\t\t\t\tdescription: "Read",
\t\t\t\tparameters: {
\t\t\t\t\ttype: "object",
\t\t\t\t\tproperties: { a: { type: "string" }, b: { type: "number" } },
\t\t\t\t},
\t\t\t},
\t\t]);
\t\tconst next = snap([
\t\t\t{
\t\t\t\tname: "read",
\t\t\t\tdescription: "Read",
\t\t\t\tparameters: {
\t\t\t\t\ttype: "object",
\t\t\t\t\tproperties: { b: { type: "number" }, a: { type: "string" } },
\t\t\t\t},
\t\t\t},
\t\t]);
\t\texpect(classifyToolsetTransition(previous, next).classification).toBe(
\t\t\t"unchanged",
\t\t);
\t});

\tit("normalizes toolset-reordered-only to unchanged", () => {
\t\tconst previous = snap([
\t\t\t{ name: "a", description: "A" },
\t\t\t{ name: "b", description: "B" },
\t\t]);
\t\tconst next = snap([
\t\t\t{ name: "b", description: "B" },
\t\t\t{ name: "a", description: "A" },
\t\t]);
\t\tconst transition = classifyToolsetTransition(previous, {
\t\t\t...next,
\t\t\tfingerprint: `${previous.fingerprint}-reordered`,
\t\t});
\t\texpect(transition.classification).toBe("unchanged");
\t\texpect(transition.changed).toBe(false);
\t});
});
''',
)

replace_exact(
    "src/index.ts",
    '''\t\tif (!capabilities.usesZaiThinkingFormat && !isNativeZaiModel(ctx.model)) {
\t\t\treturn;
\t\t}
''',
    '''\t\tif (
\t\t\tconfig.preserveThinking === undefined &&
\t\t\t!capabilities.usesZaiThinkingFormat &&
\t\t\t!isNativeZaiModel(ctx.model)
\t\t) {
\t\t\treturn;
\t\t}
''',
)

replace_exact(
    "src/boundary.test.ts",
    '''\tit("calls fetch only through the telemetry uploader for aggregate uploads", async () => {
''',
    '''\tit("applies an explicit thinking override to a Platform model without compat metadata", async () => {
\t\tconst cwd = tempCwd();
\t\twriteProjectSettings(cwd, { zai: { preserveThinking: false } });
\t\tconst model = {
\t\t\t...createZaiModel(),
\t\t\tprovider: "zai-platform",
\t\t\tbaseUrl: "https://api.z.ai/api/paas/v4",
\t\t\tcompat: undefined,
\t\t};
\t\tconst pi = createMockExtensionApi({ cwd, model });
\t\tpiZaiExtension(pi);
\t\tconst ctx = createExtensionContext(cwd, model);

\t\tawait pi.trigger(
\t\t\t"session_start",
\t\t\t{ type: "session_start", reason: "startup" },
\t\t\tctx,
\t\t);
\t\tconst [result] = await pi.trigger(
\t\t\t"before_provider_request",
\t\t\t{
\t\t\t\ttype: "before_provider_request",
\t\t\t\tpayload: { thinking: { type: "enabled", clear_thinking: false } },
\t\t\t},
\t\t\tctx,
\t\t);

\t\texpect(result).toEqual({
\t\t\tthinking: { type: "enabled", clear_thinking: true },
\t\t});
\t});

\tit("calls fetch only through the telemetry uploader for aggregate uploads", async () => {
''',
)

# Patch capability probe persistence and endpoint validation.
replace_exact(
    "src/commands/capabilities.ts",
    '''function writeProbeCache(cache: ProbeCache): void {
\tconst path = probeCachePath();
\tmkdirSync(dirname(path), { recursive: true, mode: 0o700 });
\twriteFileSync(
\t\tpath,
\t\t`${JSON.stringify(cache, null, 2)}
`,
\t\t{
\t\t\tencoding: "utf8",
\t\t\tmode: 0o600,
\t\t},
\t);
\tchmodSync(path, 0o600);
}
''',
    '''function writeProbeCache(cache: ProbeCache): string | undefined {
\ttry {
\t\tconst path = probeCachePath();
\t\tmkdirSync(dirname(path), { recursive: true, mode: 0o700 });
\t\twriteFileSync(
\t\t\tpath,
\t\t\t`${JSON.stringify(cache, null, 2)}
`,
\t\t\t{
\t\t\t\tencoding: "utf8",
\t\t\t\tmode: 0o600,
\t\t\t},
\t\t);
\t\tchmodSync(path, 0o600);
\t\treturn undefined;
\t} catch (error) {
\t\treturn error instanceof Error ? error.message : "unknown filesystem error";
\t}
}
''',
)
replace_exact(
    "src/commands/capabilities.ts",
    '''function chatEndpoint(baseUrl: string): string {
\tconst normalized = baseUrl.replace(/\\/$/, "");
\treturn normalized.endsWith("/chat/completions")
\t\t? normalized
\t\t: `${normalized}/chat/completions`;
}
''',
    '''export type ProbeTarget = {
\tendpoint: string;
\thost: string;
\trequiresHostConfirmation: boolean;
};

const NATIVE_PROBE_HOSTS: Record<string, string> = {
\tzai: "api.z.ai",
\t"zai-coding-cn": "open.bigmodel.cn",
};

export function resolveProbeTarget(model: ZaiModel): ProbeTarget {
\tlet url: URL;
\ttry {
\t\turl = new URL(model.baseUrl);
\t} catch {
\t\tthrow new Error("Probe endpoint is not a valid URL.");
\t}
\tif (url.protocol !== "https:") {
\t\tthrow new Error("Live capability probes require an HTTPS endpoint.");
\t}
\tif (url.username || url.password) {
\t\tthrow new Error("Probe endpoint URLs must not contain embedded credentials.");
\t}
\tconst expectedHost = NATIVE_PROBE_HOSTS[model.provider];
\tif (expectedHost && url.hostname !== expectedHost) {
\t\tthrow new Error(
\t\t\t`Refusing to send ${model.provider} credentials to unexpected host ${url.hostname}.`,
\t\t);
\t}
\turl.search = "";
\turl.hash = "";
\turl.pathname = url.pathname.replace(/\\/$/, "");
\tif (!url.pathname.endsWith("/chat/completions")) {
\t\turl.pathname = `${url.pathname}/chat/completions`;
\t}
\treturn {
\t\tendpoint: url.toString(),
\t\thost: url.host,
\t\trequiresHostConfirmation: model.provider === "zai-platform",
\t};
}
''',
)
replace_exact(
    "src/commands/capabilities.ts",
    '''\treturn fetch(endpoint, {
\t\tmethod: "POST",
\t\theaders,
\t\tbody: JSON.stringify(body),
\t\tsignal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
\t});
''',
    '''\treturn fetch(endpoint, {
\t\tmethod: "POST",
\t\theaders,
\t\tbody: JSON.stringify(body),
\t\tredirect: "error",
\t\tsignal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
\t});
''',
)
replace_exact(
    "src/commands/capabilities.ts",
    '''\t\t\tif (sub === "probe") {
\t\t\t\tconst confirmed = await ctx.ui.confirm(
\t\t\t\t\t"Live capability probes",
\t\t\t\t\t"Run four short synthetic Z.AI requests (may incur billing). Continue?",
\t\t\t\t);
''',
    '''\t\t\tif (sub === "probe") {
\t\t\t\tlet target: ProbeTarget;
\t\t\t\ttry {
\t\t\t\t\ttarget = resolveProbeTarget(model);
\t\t\t\t} catch (error) {
\t\t\t\t\tctx.ui.notify(
\t\t\t\t\t\terror instanceof Error ? error.message : "Invalid probe endpoint.",
\t\t\t\t\t\t"warning",
\t\t\t\t\t);
\t\t\t\t\treturn;
\t\t\t\t}
\t\t\t\tconst hostNotice = target.requiresHostConfirmation
\t\t\t\t\t? ` Target host: ${target.host}.`
\t\t\t\t\t: "";
\t\t\t\tconst confirmed = await ctx.ui.confirm(
\t\t\t\t\t"Live capability probes",
\t\t\t\t\t`Run four short synthetic Z.AI requests (may incur billing).${hostNotice} Continue?`,
\t\t\t\t);
''',
)
replace_exact(
    "src/commands/capabilities.ts",
    '''\t\t\t\tconst endpoint = chatEndpoint(model.baseUrl);
''',
    '''\t\t\t\tconst endpoint = target.endpoint;
''',
)
replace_exact(
    "src/commands/capabilities.ts",
    '''\t\t\t\twriteProbeCache(cache);

\t\t\t\tconst lines = [
''',
    '''\t\t\t\tconst persistenceError = writeProbeCache(cache);

\t\t\t\tconst lines = [
''',
)
replace_exact(
    "src/commands/capabilities.ts",
    '''\t\t\t\t\t"Stored locally as status metadata only (no response bodies).",
\t\t\t\t];
''',
    '''\t\t\t\t\tpersistenceError
\t\t\t\t\t\t? `Probe results could not be persisted: ${persistenceError}`
\t\t\t\t\t\t: "Stored locally as status metadata only (no response bodies).",
\t\t\t\t];
''',
)

write(
    "src/commands/capabilities.test.ts",
    '''import { describe, expect, it } from "vitest";
import { createZaiModel } from "../../test/mock-extension-api.ts";
import { resolveProbeTarget } from "./capabilities.ts";

describe("resolveProbeTarget", () => {
\tit("allows the canonical global Coding Plan host", () => {
\t\texpect(resolveProbeTarget(createZaiModel())).toMatchObject({
\t\t\thost: "api.z.ai",
\t\t\trequiresHostConfirmation: false,
\t\t});
\t});

\tit("rejects non-HTTPS and unexpected native hosts before auth resolution", () => {
\t\texpect(() =>
\t\t\tresolveProbeTarget({
\t\t\t\t...createZaiModel(),
\t\t\t\tbaseUrl: "http://api.z.ai/api/coding/paas/v4",
\t\t\t}),
\t\t).toThrow("HTTPS");
\t\texpect(() =>
\t\t\tresolveProbeTarget({
\t\t\t\t...createZaiModel(),
\t\t\t\tbaseUrl: "https://example.invalid/api/coding/paas/v4",
\t\t\t}),
\t\t).toThrow("unexpected host");
\t});

\tit("requires an explicit host confirmation for Platform probes", () => {
\t\tconst target = resolveProbeTarget({
\t\t\t...createZaiModel(),
\t\t\tprovider: "zai-platform",
\t\t\tbaseUrl: "https://gateway.example.test/zai/v4",
\t\t});
\t\texpect(target).toEqual({
\t\t\tendpoint: "https://gateway.example.test/zai/v4/chat/completions",
\t\t\thost: "gateway.example.test",
\t\t\trequiresHostConfirmation: true,
\t\t});
\t});
});
''',
)

# Remove the temporary workflow/script from the resulting commit.
Path("scripts/apply-pr23-review-round2.py").unlink()
Path(".github/workflows/pr23-review-round2.yml").unlink()
