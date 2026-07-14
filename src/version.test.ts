import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EXTENSION_VERSION } from "./version.generated.ts";

describe("EXTENSION_VERSION", () => {
	it("matches package.json", () => {
		const packageRoot = dirname(dirname(fileURLToPath(import.meta.url)));
		const pkg = JSON.parse(
			readFileSync(join(packageRoot, "package.json"), "utf8"),
		) as { version: string };
		expect(EXTENSION_VERSION).toBe(pkg.version);
	});
});
