import { describe, expect, it } from "vitest";
import type { ZaiAdaptiveToolsConfig } from "../config.ts";
import { collectDeferredToolNames, resolveGroupTools } from "./groups.ts";
import { LOADER_TOOL_NAME } from "./types.ts";

const config: ZaiAdaptiveToolsConfig = {
	mode: "manual",
	maxInitialTools: 8,
	stickyLoadedTools: true,
	alwaysActive: ["read", LOADER_TOOL_NAME],
	groups: {
		git: ["bash", "read"],
		db: ["db_query"],
	},
	unsupportedMode: false,
};

describe("adaptive tool groups", () => {
	it("excludes always-active tools from deferred set", () => {
		const deferred = collectDeferredToolNames(config);
		expect(deferred.has("bash")).toBe(true);
		expect(deferred.has("db_query")).toBe(true);
		expect(deferred.has("read")).toBe(false);
		expect(deferred.has(LOADER_TOOL_NAME)).toBe(false);
	});

	it("resolves configured groups", () => {
		expect(resolveGroupTools(config, "git")).toEqual(["bash", "read"]);
		expect(resolveGroupTools(config, "missing")).toBeUndefined();
	});
});
