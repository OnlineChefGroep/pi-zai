import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { resolveZaiCapabilities } from "../capabilities.ts";
import { EXTENSION_VERSION } from "../version.generated.ts";
import type { ZaiCommandDeps } from "./deps.ts";
import { formatHeading, formatKeyValue, joinCommandLines } from "./format.ts";
import { requireZaiModel } from "./helpers.ts";

type ProbeResult = {
	name: string;
	supported: boolean | "unknown";
	httpStatus?: number;
	detail: string;
};

type ProbeCache = {
	extensionVersion: string;
	piPeerFloor: string;
	provider: string;
	model: string;
	endpoint: string;
	results: ProbeResult[];
	updatedAt: string;
};

function probeCachePath(): string {
	return join(getAgentDir(), "state", "pi-zai", "capabilities-probe.json");
}

function readProbeCache(): ProbeCache | undefined {
	try {
		const raw = readFileSync(probeCachePath(), "utf8");
		const parsed = JSON.parse(raw) as ProbeCache;
		if (
			!parsed ||
			typeof parsed !== "object" ||
			parsed.extensionVersion !== EXTENSION_VERSION
		) {
			return undefined;
		}
		return parsed;
	} catch {
		return undefined;
	}
}

function writeProbeCache(cache: ProbeCache): void {
	const path = probeCachePath();
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, `${JSON.stringify(cache, null, 2)}\n`, "utf8");
}

async function runSyntheticProbe(
	name: string,
	runner: () => Promise<{ ok: boolean; status?: number; detail: string }>,
): Promise<ProbeResult> {
	try {
		const result = await runner();
		return {
			name,
			supported: result.ok,
			httpStatus: result.status,
			detail: result.detail,
		};
	} catch (error) {
		return {
			name,
			supported: false,
			detail: error instanceof Error ? error.message : "probe failed",
		};
	}
}

export function registerZaiCapabilitiesCommand(
	pi: ExtensionAPI,
	deps: ZaiCommandDeps,
): void {
	pi.registerCommand("zai-capabilities", {
		description:
			"Show Z.AI capability resolution and optional live probes (never automatic)",
		handler: async (args, ctx) => {
			const check = requireZaiModel(ctx);
			if ("error" in check) {
				ctx.ui.notify(check.error, "warning");
				return;
			}

			const model = check.model;
			const config = deps.getConfig(ctx.cwd);
			const capabilities = resolveZaiCapabilities(
				model,
				config.sessionAffinity,
			);
			const sub = args.trim().split(/\s+/)[0]?.toLowerCase() || "status";

			if (sub === "probe") {
				const confirmed = await ctx.ui.confirm(
					"Live capability probes",
					"Run synthetic Z.AI probes (several short requests; may incur billing). Continue?",
				);
				if (!confirmed) {
					ctx.ui.notify("Capability probe cancelled.", "info");
					return;
				}

				const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
				if (!auth.ok || !auth.apiKey) {
					ctx.ui.notify(
						"No API key available for live probes on the active provider.",
						"warning",
					);
					return;
				}
				const apiKey = auth.apiKey;

				const baseUrl = model.baseUrl.replace(/\/$/, "");
				const results: ProbeResult[] = [];

				results.push(
					await runSyntheticProbe("tool_choice=auto", async () => {
						const response = await fetch(`${baseUrl}/chat/completions`, {
							method: "POST",
							headers: {
								Authorization: `Bearer ${apiKey}`,
								"Content-Type": "application/json",
								"User-Agent": `pi-zai/${EXTENSION_VERSION}`,
							},
							body: JSON.stringify({
								model: model.id,
								messages: [{ role: "user", content: "Reply with OK" }],
								tools: [
									{
										type: "function",
										function: {
											name: "ping",
											description: "Synthetic probe tool",
											parameters: {
												type: "object",
												properties: {},
											},
										},
									},
								],
								tool_choice: "auto",
								max_tokens: 8,
							}),
						});
						return {
							ok: response.ok,
							status: response.status,
							detail: response.ok
								? "accepted"
								: `rejected with HTTP ${response.status}`,
						};
					}),
				);

				for (const choice of ["none", "required"] as const) {
					results.push(
						await runSyntheticProbe(`tool_choice=${choice}`, async () => {
							const response = await fetch(`${baseUrl}/chat/completions`, {
								method: "POST",
								headers: {
									Authorization: `Bearer ${apiKey}`,
									"Content-Type": "application/json",
									"User-Agent": `pi-zai/${EXTENSION_VERSION}`,
								},
								body: JSON.stringify({
									model: model.id,
									messages: [{ role: "user", content: "Reply with OK" }],
									tools: [
										{
											type: "function",
											function: {
												name: "ping",
												description: "Synthetic probe tool",
												parameters: {
													type: "object",
													properties: {},
												},
											},
										},
									],
									tool_choice: choice,
									max_tokens: 8,
								}),
							});
							return {
								ok: response.ok,
								status: response.status,
								detail: response.ok
									? "accepted (semantic obedience not verified)"
									: `rejected with HTTP ${response.status}`,
							};
						}),
					);
				}

				results.push(
					await runSyntheticProbe("tool_stream=true", async () => {
						const response = await fetch(`${baseUrl}/chat/completions`, {
							method: "POST",
							headers: {
								Authorization: `Bearer ${apiKey}`,
								"Content-Type": "application/json",
								"User-Agent": `pi-zai/${EXTENSION_VERSION}`,
							},
							body: JSON.stringify({
								model: model.id,
								messages: [{ role: "user", content: "Reply with OK" }],
								stream: true,
								tool_stream: true,
								max_tokens: 8,
							}),
						});
						// Drain/cancel body without storing content.
						try {
							await response.body?.cancel();
						} catch {
							// ignore
						}
						return {
							ok: response.ok,
							status: response.status,
							detail: response.ok
								? "accepted"
								: `rejected with HTTP ${response.status}`,
						};
					}),
				);

				const cache: ProbeCache = {
					extensionVersion: EXTENSION_VERSION,
					piPeerFloor: "0.80.7",
					provider: model.provider,
					model: model.id,
					endpoint: model.baseUrl,
					results: results.map((result) => ({
						name: result.name,
						supported: result.supported,
						httpStatus: result.httpStatus,
						detail: result.detail,
					})),
					updatedAt: new Date().toISOString(),
				};
				writeProbeCache(cache);

				const lines = [
					...formatHeading("Z.AI capability probes"),
					...results.map(
						(result) =>
							`${result.name}: ${result.supported === true ? "ok" : "no"} (${result.detail})`,
					),
					"Stored locally as status metadata only (no response bodies).",
				];
				ctx.ui.notify(joinCommandLines(lines), "info");
				return;
			}

			const cache = readProbeCache();
			const lines = [
				...formatHeading("Z.AI capabilities"),
				formatKeyValue("Extension", deps.extensionVersion),
				formatKeyValue("Provider ownership", capabilities.providerOwnership),
				formatKeyValue("API family", capabilities.apiFamily),
				formatKeyValue(
					"Thinking format",
					capabilities.usesZaiThinkingFormat ? "zai" : "other/unknown",
				),
				formatKeyValue(
					"Tool stream metadata",
					capabilities.streamsToolCalls ? "yes" : "no",
				),
				formatKeyValue("Dynamic tools", capabilities.dynamicToolMode),
				formatKeyValue(
					"Tool choice API support",
					capabilities.toolChoiceSupportedByApi
						? "Responses-family yes"
						: "not claimed for this API",
				),
				formatKeyValue("Affinity source", capabilities.sessionAffinitySource),
				formatKeyValue(
					"Adaptive tools",
					config.adaptiveTools.unsupportedMode
						? `${config.adaptiveTools.mode} (unsupported→observe)`
						: config.adaptiveTools.mode,
				),
				formatKeyValue(
					"Last probe cache",
					cache
						? `${cache.updatedAt} (${cache.results.length} results)`
						: "none",
				),
				"",
				"Use /zai-capabilities probe to run opt-in live checks.",
			];
			ctx.ui.notify(joinCommandLines(lines), "info");
		},
	});
}
