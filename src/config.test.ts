import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CONFIG_DIR_NAME } from "@earendil-works/pi-coding-agent";
import { afterEach, describe, expect, it } from "vitest";
import { loadZaiConfig } from "./config.ts";

const temporaryDirectories: string[] = [];

afterEach(() => {
	for (const directory of temporaryDirectories.splice(0)) {
		rmSync(directory, { recursive: true, force: true });
	}
});

function writeConfig(value: unknown): string {
	const cwd = mkdtempSync(join(tmpdir(), "pi-zai-config-"));
	temporaryDirectories.push(cwd);
	mkdirSync(join(cwd, CONFIG_DIR_NAME), { recursive: true });
	writeFileSync(
		join(cwd, CONFIG_DIR_NAME, "settings.json"),
		JSON.stringify(value),
	);
	return cwd;
}

describe("loadZaiConfig", () => {
	it("defaults remote telemetry and adaptive tools to off", () => {
		expect(loadZaiConfig("/tmp")).toMatchObject({
			telemetryMode: "off",
			adaptiveTools: { mode: "off", requestedMode: "off" },
		});
	});

	it("falls unsupported adaptive/strict modes back to observe", () => {
		const cwd = writeConfig({
			zai: { adaptiveTools: { mode: "adaptive", groups: { git: ["bash"] } } },
		});
		const config = loadZaiConfig(cwd);
		expect(config.adaptiveTools.mode).toBe("observe");
		expect(config.adaptiveTools.requestedMode).toBe("adaptive");
		expect(config.adaptiveTools.unsupportedMode).toBe(true);
		expect(config.adaptiveTools.groups.git).toEqual(["bash"]);
	});

	it("trims and deduplicates tool names without prototype pollution", () => {
		const groups = JSON.parse(
			'{" shell ":[" bash ","bash",""],"":["write"],"__proto__":["edit"]}',
		) as Record<string, string[]>;
		const cwd = writeConfig({
			zai: {
				adaptiveTools: {
					mode: "manual",
					alwaysActive: [" read ", "read", ""],
					groups,
				},
			},
		});
		const adaptive = loadZaiConfig(cwd).adaptiveTools;
		expect(adaptive.alwaysActive).toEqual(["read"]);
		expect(adaptive.groups.shell).toEqual(["bash"]);
		expect(adaptive.groups["__proto__"]).toEqual(["edit"]);
		expect(Object.getPrototypeOf(adaptive.groups)).toBeNull();
	});
});
