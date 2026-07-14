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

describe("loadZaiConfig", () => {
	it("defaults remote telemetry to off", () => {
		expect(loadZaiConfig("/tmp")).toMatchObject({
			telemetryMode: "off",
		});
	});

	it("defaults adaptive tools to off", () => {
		expect(loadZaiConfig("/tmp").adaptiveTools.mode).toBe("off");
	});

	it("falls unsupported adaptive/strict modes back to observe", () => {
		const cwd = mkdtempSync(join(tmpdir(), "pi-zai-config-"));
		temporaryDirectories.push(cwd);
		mkdirSync(join(cwd, CONFIG_DIR_NAME), { recursive: true });
		writeFileSync(
			join(cwd, CONFIG_DIR_NAME, "settings.json"),
			JSON.stringify({
				zai: { adaptiveTools: { mode: "adaptive", groups: { git: ["bash"] } } },
			}),
		);
		const config = loadZaiConfig(cwd);
		expect(config.adaptiveTools.mode).toBe("observe");
		expect(config.adaptiveTools.unsupportedMode).toBe(true);
		expect(config.adaptiveTools.groups.git).toEqual(["bash"]);
	});
});
