export const PRESENCE_CACHE_MS = 10_000;

export function liveWsCount(queued: number, seated: number): number {
 return queued + seated;
}

export function presenceLit(live: number): boolean {
 return live > 0;
}
