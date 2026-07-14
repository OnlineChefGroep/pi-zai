import { describe, expect, it } from "vitest";
import { AttemptTracker } from "./attempt-tracker.ts";

describe("AttemptTracker lifecycle", () => {
	it("prepares at query start and arms at provider request", () => {
		const tracker = new AttemptTracker();
		tracker.prepareQueryAttempt("q-0001-test", 1000);
		tracker.markHeadersReceived(1100);
		tracker.markFirstDelta(1200);
		tracker.armProviderAttempt({
			requestId: "q-0001-test-a1",
			attempt: 1,
			payloadFingerprint: "abc123",
			now: 1000,
		});

		const record = tracker.buildRecord({
			projectId: "project-a",
			sessionHash: "session-a",
			provider: "zai",
			model: "glm-5.2",
			endpointKind: "coding",
			extensionVersion: "0.1.1",
			occurredAt: 1500,
		});

		expect(record).toMatchObject({
			queryId: "q-0001-test",
			requestId: "q-0001-test-a1",
			attempt: 1,
			payloadFingerprint: "abc123",
			requestToHeadersMs: 100,
			requestToFirstDeltaMs: 200,
			totalMs: 500,
		});
	});

	it("records first tool delta relative to query start", () => {
		const tracker = new AttemptTracker();
		tracker.beginAttempt({
			queryId: "q-1",
			requestId: "q-1-a1",
			attempt: 1,
			payloadFingerprint: "fp",
			now: 1000,
		});
		tracker.markFirstToolDelta(1400);
		const record = tracker.buildRecord({
			projectId: "project-a",
			sessionHash: "session-a",
			provider: "zai",
			model: "glm-5.2",
			endpointKind: "coding",
			extensionVersion: "0.5.0",
			occurredAt: 1600,
			toolCallsInTurn: 2,
			toolErrorsInTurn: 0,
			toolDurationMsTotal: 300,
		});
		expect(record).toMatchObject({
			requestToFirstToolDeltaMs: 400,
			toolCallsInTurn: 2,
			toolErrorsInTurn: 0,
			toolDurationMsTotal: 300,
		});
	});

	it("accumulates usage across assistant messages in a turn", () => {
		const tracker = new AttemptTracker();
		tracker.prepareQueryAttempt("q-1", 1000);
		tracker.accumulateTurnUsage({
			input: 100,
			output: 50,
			cacheRead: 20,
			cacheWrite: 0,
			totalTokens: 170,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0.01 },
		});
		tracker.accumulateTurnUsage({
			input: 80,
			output: 30,
			cacheRead: 10,
			cacheWrite: 0,
			totalTokens: 120,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0.02 },
		});
		tracker.armProviderAttempt({
			requestId: "q-1-a1",
			attempt: 1,
			payloadFingerprint: "fp",
			now: 1100,
		});

		const record = tracker.buildRecord({
			projectId: "project-a",
			sessionHash: "session-a",
			provider: "zai",
			model: "glm-5.2",
			endpointKind: "coding",
			extensionVersion: "0.5.0",
			occurredAt: 2000,
		});

		expect(record).toMatchObject({
			inputTokens: 180,
			outputTokens: 80,
			cacheReadTokens: 30,
			estimatedApiCostMicrousd: 30_000,
		});
	});

	it("preserves first delta timestamps across retries", () => {
		const tracker = new AttemptTracker();
		tracker.prepareQueryAttempt("q-1", 1000);
		tracker.armProviderAttempt({
			requestId: "q-1-a1",
			attempt: 1,
			payloadFingerprint: "fp1",
			now: 1000,
		});
		tracker.markFirstDelta(1200);
		tracker.beginAttempt({
			queryId: "q-1",
			requestId: "q-1-a2",
			attempt: 2,
			payloadFingerprint: "fp2",
			now: 2000,
		});

		const record = tracker.buildRecord({
			projectId: "project-a",
			sessionHash: "session-a",
			provider: "zai",
			model: "glm-5.2",
			endpointKind: "coding",
			extensionVersion: "0.5.0",
			occurredAt: 2500,
		});

		expect(record?.requestToFirstDeltaMs).toBe(200);
		expect(record?.totalMs).toBe(1500);
	});
});
