const HEARTBEAT_TTL_MS = 18_000;

export function countHeartbeats(
	beats: Map<string, number>,
	now: number,
	ttl = HEARTBEAT_TTL_MS,
): number {
	for (const [id, at] of beats) {
		if (now - at > ttl) beats.delete(id);
	}
	return beats.size;
}

export function touchHeartbeat(
	beats: Map<string, number>,
	id: string,
	now: number,
): void {
	beats.set(id, now);
}

export function dropHeartbeat(beats: Map<string, number>, id: string): void {
	beats.delete(id);
}
