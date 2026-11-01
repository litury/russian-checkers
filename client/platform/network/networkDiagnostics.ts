type NetworkDiagnostic = {
	transport: 'http' | 'websocket';
	phase: 'request' | 'guest' | 'opening' | 'auth' | 'connected' | 'recovery';
	result: 'ok' | 'timeout' | 'cancelled' | 'network' | 'rejected' | 'closed';
	elapsedMs: number;
	status?: number;
	closeCode?: number;
};

const events: NetworkDiagnostic[] = [];

export function recordNetworkDiagnostic(event: NetworkDiagnostic): void {
	events.push({ ...event, elapsedMs: Math.max(0, Math.round(event.elapsedMs)) });
	if (events.length > 30) events.shift();
	console.debug('[network]', events.at(-1));
}

export function readNetworkDiagnostics(): NetworkDiagnostic[] {
	return events.map(event => ({ ...event }));
}
