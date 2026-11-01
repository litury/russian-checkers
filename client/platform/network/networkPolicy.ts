export const HTTP_TIMEOUT_MS = 8000;
export const SOCKET_TIMEOUT_MS = 8000;
export const INITIAL_CONNECT_MS = 20_000;
export const INITIAL_CONNECT_ATTEMPTS = 2;
export const RECOVERY_WINDOW_MS = 60_000;

export function reconnectDelay(attempt: number, random = Math.random): number {
	const ceiling = Math.min(5000, 500 * 2 ** Math.min(attempt, 4));
	return Math.round(ceiling * (0.5 + random() * 0.5));
}
