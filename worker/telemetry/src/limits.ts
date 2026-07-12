export const MAX_BODY_BYTES = 32_768;
export const MAX_BY_PROVIDER_MODEL_ROWS = 64;
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX_REQUESTS = 30;

export type RateLimitBinding = {
	limit(options: { key: string }): Promise<{ success: boolean }>;
};

export type RateLimitEnv = {
	PI_ZAI_RATE_LIMITER?: RateLimitBinding;
};

type RateBucket = {
	count: number;
	windowStart: number;
};

const rateLimitBuckets = new Map<string, RateBucket>();

export function resetRateLimitState(): void {
	rateLimitBuckets.clear();
}

function pruneRateLimitBuckets(now: number): void {
	for (const [key, bucket] of rateLimitBuckets) {
		if (now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
			rateLimitBuckets.delete(key);
		}
	}
}

export function checkRateLimit(clientKey: string, now = Date.now()): boolean {
	pruneRateLimitBuckets(now);
	const bucket = rateLimitBuckets.get(clientKey);
	if (!bucket || now - bucket.windowStart >= RATE_LIMIT_WINDOW_MS) {
		rateLimitBuckets.set(clientKey, { count: 1, windowStart: now });
		return true;
	}
	if (bucket.count >= RATE_LIMIT_MAX_REQUESTS) {
		return false;
	}
	bucket.count += 1;
	return true;
}

export function resolveClientKey(request: Request): string {
	return (
		request.headers.get("CF-Connecting-IP") ??
		request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ??
		"unknown"
	);
}

export function isBodyTooLarge(request: Request): boolean {
	const contentLength = request.headers.get("Content-Length");
	if (!contentLength) return false;
	const parsed = Number(contentLength);
	return Number.isFinite(parsed) && parsed > MAX_BODY_BYTES;
}

export async function enforceRateLimit(
	request: Request,
	env: RateLimitEnv,
): Promise<boolean> {
	const clientKey = resolveClientKey(request);
	if (env.PI_ZAI_RATE_LIMITER) {
		const { success } = await env.PI_ZAI_RATE_LIMITER.limit({ key: clientKey });
		return success;
	}
	return checkRateLimit(clientKey);
}
