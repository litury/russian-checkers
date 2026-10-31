export function createRateLimiter(_maxKeys = 10_000) {
	const hits = new Map<string, { count: number; expiresAt: number }>();
	let nextSweep = 0;

	const limited = (key: string, max: number, windowMs = 60_000) => {
		const now = Date.now();
		if (now >= nextSweep) {
			nextSweep = now + 1000;
			for (const [storedKey, hit] of hits) {
				if (now >= hit.expiresAt) hits.delete(storedKey);
				else nextSweep = Math.min(nextSweep, hit.expiresAt);
			}
		}
		const cur = hits.get(key);
		if (!cur || now >= cur.expiresAt) {
			if (!cur && hits.size >= _maxKeys) return true;
			hits.set(key, { count: 1, expiresAt: now + windowMs });
			nextSweep = Math.min(nextSweep, now + windowMs);
			return false;
		}
		if (cur.count >= max) return true;
		cur.count++;
		return false;
	};
	return limited;
}
export type RateLimiter = ReturnType<typeof createRateLimiter>;
