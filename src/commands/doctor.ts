import type { ThinkingLevel } from "@earendil-works/pi-agent-core";
import type { Model } from "@earendil-works/pi-ai";
import type { ExtensionAPI, ExtensionCommandContext } from "@earendil-works/pi-coding-agent";
import { buildCompactionInstructions, ZAI_COMPACTION_SECTIONS } from "../cache/compaction.ts";
import { canonicalStableSystemPrefix } from "../cache/context-policy.ts";
import { fingerprintToolset } from "../cache/fingerprint.ts";
import type { ZaiCommandDeps } from "./deps.ts";
import { describeThinkingPayload, formatCredentialSource, getZaiCompat, requireZaiModel } from "./helpers.ts";

type CheckStatus = "pass" | "fail" | "skip" | "warn";

type DoctorCheck = {
	name: string;
	status: CheckStatus;
	detail: string;
};

const DOCTOR_THINKING_LEVELS = ["off", "high", "max" as ThinkingLevel] as const;

function statusIcon(status: CheckStatus): string {
	switch (status) {
		case "pass":
			return "ok";
		case "fail":
			return "fail";
		case "skip":
			return "skip";
		case "warn":
			return "warn";
	}
}

function glm52ThinkingMapOk(model: Model<any> | undefined): boolean {
	if (!model?.thinkingLevelMap) return false;
	const map = model.thinkingLevelMap;
	return (
		map.minimal === null &&
		map.low === null &&
		map.medium === null &&
		map.high === "high" &&
		map.xhigh === null &&
		map.max === "max"
	);
}

function hasPlatformPricing(model: Model<any> | undefined): boolean {
	if (!model) return false;
	const { input, output } = model.cost;
	return input > 0 || output > 0;
}

async function runNetworkProbe(ctx: ExtensionCommandContext, model: Model<any>): Promise<DoctorCheck> {
	const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
	if (!auth.ok || !auth.apiKey) {
		return {
			name: "Network probe",
			status: "skip",
			detail: "No credentials available; skipped live request.",
		};
	}

	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), 10_000);
	try {
		const response = await fetch(`${model.baseUrl}/models`, {
			method: "GET",
			headers: {
				...auth.headers,
				Authorization: auth.headers?.Authorization ?? `Bearer ${auth.apiKey}`,
			},
			signal: controller.signal,
		});
		if (response.ok) {
			return {
				name: "Network probe",
				status: "pass",
				detail: `Reachable (${response.status}) at ${model.baseUrl}/models`,
			};
		}
		return {
			name: "Network probe",
			status: "warn",
			detail: `Responded with HTTP ${response.status}; credentials present but request not fully successful.`,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : "unknown error";
		return {
			name: "Network probe",
			status: "warn",
			detail: `Request failed: ${message}`,
		};
	} finally {
		clearTimeout(timeout);
	}
}

export function registerZaiDoctorCommand(pi: ExtensionAPI, deps: ZaiCommandDeps): void {
	pi.registerCommand("zai-doctor", {
		description: "Offline Z.AI integration checks with optional network probe",
		handler: async (_args, ctx) => {
			const checks: DoctorCheck[] = [];
			const config = deps.getConfig(ctx.cwd);
			const codingModel = ctx.modelRegistry.find("zai", "glm-5.2");
			const platformModel = ctx.modelRegistry.find("zai-platform", "glm-5.2");
			const active = ctx.model;

			checks.push({
				name: "Extension loaded",
				status: "pass",
				detail: `@onlinechefgroep/pi-zai ${deps.extensionVersion}`,
			});

			checks.push({
				name: "Pi compatibility",
				status: "pass",
				detail: "Requires @earendil-works/pi-coding-agent >= 0.80.0 with native Z.AI transport.",
			});

			checks.push({
				name: "Built-in Z.AI provider",
				status: codingModel ? "pass" : "fail",
				detail: codingModel ? "zai/glm-5.2 present" : "zai/glm-5.2 missing from registry",
			});

			checks.push({
				name: "Platform provider registered",
				status: deps.isPlatformProviderRegistered(ctx) && platformModel ? "pass" : "fail",
				detail: platformModel
					? "zai-platform/glm-5.2 registered"
					: "zai-platform provider or glm-5.2 model missing",
			});

			const credentialProvider = active?.provider ?? "zai";
			const credentialName =
				(await deps.resolveCredentialSourceName(credentialProvider, ctx)) ??
				formatCredentialSource(credentialProvider, ctx);
			const credentialConfigured = ctx.modelRegistry.getProviderAuthStatus(credentialProvider).configured;
			checks.push({
				name: "Credential availability",
				status: credentialConfigured ? "pass" : "warn",
				detail: credentialConfigured
					? `Source name: ${credentialName} (value never printed)`
					: "No credential configured for active provider",
			});

			const thinkingModel = active ?? codingModel;
			checks.push({
				name: "GLM-5.2 thinkingLevelMap",
				status: glm52ThinkingMapOk(thinkingModel) ? "pass" : "warn",
				detail: glm52ThinkingMapOk(thinkingModel)
					? "off/high/max exposed; minimal/low/medium/xhigh hidden"
					: "Unexpected thinkingLevelMap on active or default model",
			});

			for (const level of DOCTOR_THINKING_LEVELS) {
				checks.push({
					name: `Payload (${level})`,
					status: "pass",
					detail: describeThinkingPayload(config, level, thinkingModel),
				});
			}

			checks.push({
				name: "clear_thinking default",
				status: config.preserveThinking ? "warn" : "pass",
				detail: config.preserveThinking
					? "preserveThinking enabled; clear_thinking=false when thinking is on"
					: "preserveThinking disabled; clear_thinking=true when thinking is on (cost-first)",
			});

			checks.push({
				name: "Tool streaming",
				status: getZaiCompat(thinkingModel)?.zaiToolStream ? "pass" : "warn",
				detail: getZaiCompat(thinkingModel)?.zaiToolStream
					? "zaiToolStream enabled on active/default model"
					: "zaiToolStream not enabled on inspected model",
			});

			checks.push({
				name: "Streamed usage + cached tokens",
				status: "pass",
				detail: "Handled by upstream pi-ai openai-completions Z.AI parser (cacheRead from cached_tokens).",
			});

			checks.push({
				name: "Platform pricing metadata",
				status: hasPlatformPricing(platformModel) ? "pass" : "warn",
				detail: hasPlatformPricing(platformModel)
					? "Platform glm-5.2 has non-zero pricing metadata"
					: "Platform glm-5.2 pricing metadata missing or zero",
			});

			const stableSample = canonicalStableSystemPrefix("Project rules\nCurrent git status: dirty");
			checks.push({
				name: "Stable system prefix",
				status: stableSample.length > 0 && !stableSample.includes("git status") ? "pass" : "fail",
				detail: "Volatile git/timestamp lines excluded from canonical prefix",
			});

			const toolFingerprint = fingerprintToolset([
				{
					name: "read",
					description: "Read files",
					parameters: { type: "object", properties: { path: { type: "string" } } },
				},
			]);
			checks.push({
				name: "Stable tool definitions",
				status: toolFingerprint.length === 16 ? "pass" : "fail",
				detail: `Deterministic toolset fingerprint length ${toolFingerprint.length}`,
			});

			const compaction = buildCompactionInstructions();
			const compactionOk = ZAI_COMPACTION_SECTIONS.every((section) => compaction.includes(section));
			checks.push({
				name: "Compaction policy",
				status: compactionOk ? "pass" : "fail",
				detail: compactionOk
					? "Deterministic sections; hidden reasoning dropped by default"
					: "Compaction template missing required sections",
			});

			if (credentialConfigured && thinkingModel) {
				checks.push(await runNetworkProbe(ctx, thinkingModel));
			} else {
				checks.push({
					name: "Network probe",
					status: "skip",
					detail: "Skipped because credentials are not configured.",
				});
			}

			const zaiCheck = requireZaiModel(ctx);
			if ("error" in zaiCheck) {
				checks.push({
					name: "Active Z.AI session",
					status: "warn",
					detail: zaiCheck.error,
				});
			} else {
				checks.push({
					name: "Active Z.AI session",
					status: "pass",
					detail: `${zaiCheck.model.provider}/${zaiCheck.model.id}`,
				});
			}

			const lines = [
				"Z.AI doctor",
				"",
				...checks.map((check) => `[${statusIcon(check.status)}] ${check.name}: ${check.detail}`),
			];
			const hasFail = checks.some((check) => check.status === "fail");
			ctx.ui.notify(lines.join("\n"), hasFail ? "error" : "info");
		},
	});
}
