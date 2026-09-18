export const PRESENCE_CACHE_MS = 10_000;
export const HEARTBEAT_TTL_MS = 45_000;
export const HEARTBEAT_MS = 15_000;

export function liveWsCount(queued: number, seated: number): number {
 return queued + seated;
}

export function presenceLit(live: number): boolean {
 return live > 0;
}

export function countHeartbeats(beats: Map<string, number>, now: number, ttl = HEARTBEAT_TTL_MS): number {
 for (const [id, at] of beats) {
  if (now - at > ttl) beats.delete(id);
 }
 return beats.size;
}

export function touchHeartbeat(beats: Map<string, number>, id: string, now: number): void {
 beats.set(id, now);
}

export function dropHeartbeat(beats: Map<string, number>, id: string): void {
 beats.delete(id);
}
