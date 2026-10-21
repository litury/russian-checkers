export function createRateLimiter() {
	const hits = new Map<string, { n: number; t: number }>();

	const limited = (key: string, max: number, windowMs = 60_000) => {
		const now = Date.now();
		const cur = hits.get(key);
		if (!cur || now - cur.t > windowMs) {
			hits.set(key, { n: 1, t: now });
			return false;
		}
		cur.n += 1;
		return cur.n > max;
	};
	return limited;
}
export type RateLimiter = ReturnType<typeof createRateLimiter>;
