import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG_DIR_NAME, getAgentDir } from "@earendil-works/pi-coding-agent";

export interface ZaiSettings {
	preserveThinking?: boolean;
}

export interface ZaiConfig {
	preserveThinking: boolean;
}

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

function readZaiSettingsSection(cwd: string): ZaiSettings | undefined {
	const global = readSettingsFile(join(getAgentDir(), "settings.json"));
	const project = readSettingsFile(join(cwd, CONFIG_DIR_NAME, "settings.json"));
	const globalZai = global?.zai;
	const projectZai = project?.zai;
	if (
		(globalZai === undefined || typeof globalZai !== "object" || globalZai === null) &&
		(projectZai === undefined || typeof projectZai !== "object" || projectZai === null)
	) {
		return undefined;
	}
	return {
		...(typeof globalZai === "object" && globalZai !== null ? (globalZai as ZaiSettings) : {}),
		...(typeof projectZai === "object" && projectZai !== null ? (projectZai as ZaiSettings) : {}),
	};
}

function parseBooleanEnv(value: string | undefined, defaultValue: boolean): boolean {
	if (value === undefined) return defaultValue;
	const normalized = value.trim().toLowerCase();
	if (normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on") {
		return true;
	}
	if (normalized === "0" || normalized === "false" || normalized === "no" || normalized === "off") {
		return false;
	}
	return defaultValue;
}

export function loadZaiConfig(cwd = process.cwd()): ZaiConfig {
	if (process.env.PI_ZAI_PRESERVE_THINKING !== undefined) {
		return {
			preserveThinking: parseBooleanEnv(process.env.PI_ZAI_PRESERVE_THINKING, false),
		};
	}

	const settings = readZaiSettingsSection(cwd);
	return {
		preserveThinking: settings?.preserveThinking ?? false,
	};
}
