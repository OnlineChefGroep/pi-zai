import { describe, expect, it } from "vitest";
import {
	findBenchmarkScenario,
	findBenchmarkVariant,
	formatBenchmarkInstructions,
	formatBenchmarkManifest,
} from "./manifest.ts";

describe("benchmark manifest", () => {
	it("resolves A0-A3 variants", () => {
		expect(findBenchmarkVariant("a2")?.id).toBe("A2");
		expect(findBenchmarkVariant("unknown")).toBeUndefined();
	});

	it("resolves scenario ids", () => {
		expect(findBenchmarkScenario("tool-drift")?.turns).toBe(12);
	});

	it("formats setup instructions with settings JSON", () => {
		const text = formatBenchmarkInstructions("A2", "stable-conversation");
		expect(text).toContain("promptStability");
		expect(text).toContain("safe");
		expect(text).not.toContain("telemetry.pi-zai");
	});

	it("isolates A3 affinity from safe prompt normalization", () => {
		const a3 = findBenchmarkVariant("A3");
		expect(a3?.settings).toMatchObject({
			promptStability: { mode: "observe" },
			sessionAffinity: "experimental",
		});
	});

	it("does not tell native A0 to call extension commands", () => {
		const instructions = formatBenchmarkInstructions(
			"A0",
			"stable-conversation",
		);
		expect(instructions).toContain("Disable or uninstall pi-zai");
		expect(instructions).toContain("cannot call /zai-cache");
		expect(instructions).not.toContain("/zai-data export-json");
	});

	it("uses relative miss reduction rather than an impossible hit gap", () => {
		const manifest = formatBenchmarkManifest();
		expect(manifest).toContain("relative miss-rate reduction");
		expect(manifest).not.toContain("5pp median cache-hit gap");
	});
});
