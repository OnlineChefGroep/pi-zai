import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { describe, expect, it } from "vitest";
import {
	canonicalizeToolParts,
	fingerprintCanonicalToolset,
	type ToolFingerprintInput,
} from "./fingerprint.ts";
import {
	captureActiveToolset,
	classifyToolsetTransition,
	type ToolsetSnapshot,
} from "./toolset-snapshot.ts";

function snap(inputs: ToolFingerprintInput[]): ToolsetSnapshot {
	const tools = inputs
		.map(canonicalizeToolParts)
		.sort((a, b) => a.name.localeCompare(b.name));
	return {
		count: tools.length,
		fingerprint: fingerprintCanonicalToolset(tools),
		tools,
	};
}

describe("classifyToolsetTransition", () => {
	it("fails open when Pi tool enumeration throws", () => {
		const pi = {
			getActiveTools: () => {
				throw new Error("temporary runtime failure");
			},
		} as unknown as ExtensionAPI;
		expect(captureActiveToolset(pi)).toBeUndefined();
	});

	it("keeps stable toolsets unchanged", () => {
		const previous = snap([
			{ name: "read", description: "Read", parameters: { type: "object" } },
		]);
		const next = snap([
			{ name: "read", description: "Read", parameters: { type: "object" } },
		]);
		expect(classifyToolsetTransition(previous, next).classification).toBe(
			"unchanged",
		);
	});

	it("classifies additive tool activation", () => {
		const previous = snap([{ name: "read", description: "Read" }]);
		const next = snap([
			{ name: "read", description: "Read" },
			{ name: "bash", description: "Shell" },
		]);
		const transition = classifyToolsetTransition(previous, next);
		expect(transition.classification).toBe("tools-added");
		expect(transition.addedCount).toBe(1);
		expect(transition.changed).toBe(true);
	});

	it("classifies removals", () => {
		const previous = snap([
			{ name: "read", description: "Read" },
			{ name: "bash", description: "Shell" },
		]);
		const next = snap([{ name: "read", description: "Read" }]);
		expect(classifyToolsetTransition(previous, next).classification).toBe(
			"tools-removed",
		);
	});

	it("classifies schema changes under the same name", () => {
		const previous = snap([
			{
				name: "read",
				description: "Read",
				parameters: {
					type: "object",
					properties: { path: { type: "string" } },
				},
			},
		]);
		const next = snap([
			{
				name: "read",
				description: "Read",
				parameters: {
					type: "object",
					properties: { path: { type: "string" }, offset: { type: "number" } },
				},
			},
		]);
		expect(classifyToolsetTransition(previous, next).classification).toBe(
			"tool-schema-changed",
		);
	});

	it("treats object-key reordering as unchanged", () => {
		const previous = snap([
			{
				name: "read",
				description: "Read",
				parameters: {
					type: "object",
					properties: { a: { type: "string" }, b: { type: "number" } },
				},
			},
		]);
		const next = snap([
			{
				name: "read",
				description: "Read",
				parameters: {
					type: "object",
					properties: { b: { type: "number" }, a: { type: "string" } },
				},
			},
		]);
		expect(classifyToolsetTransition(previous, next).classification).toBe(
			"unchanged",
		);
	});

	it("normalizes toolset-reordered-only to unchanged", () => {
		const previous = snap([
			{ name: "a", description: "A" },
			{ name: "b", description: "B" },
		]);
		const next = snap([
			{ name: "b", description: "B" },
			{ name: "a", description: "A" },
		]);
		const transition = classifyToolsetTransition(previous, {
			...next,
			fingerprint: `${previous.fingerprint}-reordered`,
		});
		expect(transition.classification).toBe("unchanged");
		expect(transition.changed).toBe(false);
	});
});
