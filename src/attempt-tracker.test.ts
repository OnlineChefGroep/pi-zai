import { describe, expect, it } from "vitest";
import { AttemptTracker } from "./attempt-tracker.ts";

describe("AttemptTracker lifecycle", () => {
	it("prepares at query start and arms at provider request", () => {
		const tracker = new AttemptTracker();
		tracker.prepareQueryAttempt("q-0001-test");
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

	it("records first tool delta relative to request start", () => {
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
			extensionVersion: "0.3.0",
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
});
