import { describe, expect, it } from "vitest";
import { fingerprintToolset } from "./fingerprint.ts";
import {
	classifyToolsetTransition,
	type ToolsetSnapshot,
} from "./toolset-snapshot.ts";

function snap(tools: ToolsetSnapshot["tools"]): ToolsetSnapshot {
	const sorted = [...tools].sort((a, b) => a.name.localeCompare(b.name));
	return {
		count: sorted.length,
		fingerprint: fingerprintToolset(sorted),
		tools: sorted,
	};
}

describe("classifyToolsetTransition", () => {
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
		const next: ToolsetSnapshot = {
			count: 2,
			fingerprint: "different-but-same-content",
			tools: [
				{ name: "b", description: "B" },
				{ name: "a", description: "A" },
			],
		};
		// Force unequal fingerprints while content matches after sort identity.
		const transition = classifyToolsetTransition(previous, {
			...next,
			fingerprint: `${previous.fingerprint}-reordered`,
		});
		expect(transition.classification).toBe("unchanged");
		expect(transition.changed).toBe(false);
	});
});
