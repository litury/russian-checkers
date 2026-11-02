import { MATCH_PROTOCOL_VERSION } from '@/shared/protocol/matchResult';
import { BUILD_ID } from '../browser/buildInfo';
import { startupDiagnostics } from '../browser/startupDiagnostics';

const reasons = [
	'unauthorized',
	'update_required',
	'rate',
	'browser_unsupported',
	'asset_load_failed',
	'connection_lost',
	'other',
] as const;
export function diagnosticReason(_value: unknown): (typeof reasons)[number] {
	return reasons.includes(_value as (typeof reasons)[number])
		? (_value as (typeof reasons)[number])
		: 'other';
}

type NetworkDiagnostic = {
	transport: 'http' | 'websocket' | 'assets';
	phase:
		| 'request'
		| 'guest'
		| 'opening'
		| 'auth'
		| 'connected'
		| 'recovery'
		| 'loading';
	result: 'ok' | 'timeout' | 'cancelled' | 'network' | 'rejected' | 'closed';
	elapsedMs: number;
	status?: number;
	closeCode?: number;
	reason?: string;
};

const events: NetworkDiagnostic[] = [];

export function recordNetworkDiagnostic(event: NetworkDiagnostic): void {
	events.push({
		transport: event.transport,
		phase: event.phase,
		result: event.result,
		elapsedMs: Math.max(0, Math.round(event.elapsedMs)),
		...(event.status === undefined ? {} : { status: event.status }),
		...(event.closeCode === undefined ? {} : { closeCode: event.closeCode }),
		...(event.reason === undefined
			? {}
			: { reason: diagnosticReason(event.reason) }),
	});
	if (events.length > 30) events.shift();
	console.debug('[network]', events.at(-1));
}

export function readNetworkDiagnostics(): NetworkDiagnostic[] {
	return events.map((event) => ({ ...event }));
}

export function networkReport(): string {
	const browser =
		navigator.userAgent.match(/(?:Firefox|Edg|Chrome|Version)\/[\d.]+/)?.[0] ??
		'unknown';
	return JSON.stringify(
		{
			build: BUILD_ID,
			protocol: MATCH_PROTOCOL_VERSION,
			generatedAt: new Date().toISOString(),
			browser,
			online: navigator.onLine,
			startup: startupDiagnostics(),
			features: {
				webSocket: typeof WebSocket !== 'undefined',
				abortController: typeof AbortController !== 'undefined',
				abortAny: typeof AbortSignal.any === 'function',
				abortTimeout: typeof AbortSignal.timeout === 'function',
			},
			events: readNetworkDiagnostics(),
		},
		null,
		2,
	);
}
