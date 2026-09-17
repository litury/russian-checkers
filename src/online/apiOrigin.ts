export type ApiLocation = {protocol: string; hostname: string; host: string};

export function apiOrigin(
	envUrl?: string,
	loc?: ApiLocation | null,
): string {
	const baked = (envUrl ?? '').trim().replace(/\/$/, '');
	if (baked) return baked;
	if (!loc) return 'http://127.0.0.1:8787';
	const local =
		loc.hostname === 'localhost' || loc.hostname === '127.0.0.1' || loc.hostname === '::1';
	if (local) return `${loc.protocol}//${loc.hostname}:8787`;
	return `${loc.protocol}//${loc.host}`;
}

export function wsUrl(origin: string): string {
	const url = new URL(origin);
	url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
	url.pathname = '/ws';
	url.search = '';
	url.hash = '';
	return url.toString();
}

export function runtimeApiOrigin(): string {
	const envUrl = typeof import.meta !== 'undefined' ? (import.meta as ImportMeta & {env?: {VITE_API_URL?: string}}).env?.VITE_API_URL : '';
	const loc =
		typeof location === 'undefined'
			? null
			: {protocol: location.protocol, hostname: location.hostname, host: location.host};
	return apiOrigin(envUrl, loc);
}
