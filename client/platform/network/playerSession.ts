export interface PlayerSession {
	id: string;
	token: string;
}

const sessionKey = 'checkers.playerSession';
let observed: string | undefined;

function snapshot(): string {
	return (
		localStorage.getItem(sessionKey) ??
		JSON.stringify({
			id: localStorage.getItem('checkers.playerId'),
			token: localStorage.getItem('checkers.playerToken'),
		})
	);
}

export function isPlayerSession(value: unknown): value is PlayerSession {
	if (!value || typeof value !== 'object') return false;
	const session = value as PlayerSession;
	return (
		typeof session.id === 'string' &&
		/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(session.id) &&
		typeof session.token === 'string' &&
		/^[\w-]{32}$/.test(session.token)
	);
}

export function readPlayerSession(): PlayerSession | null {
	let current: string;
	try {
		current = snapshot();
	} catch {
		throw new Error('storage');
	}
	if (observed !== undefined && observed !== current)
		throw new Error('session_changed');
	observed = current;
	let parsed: unknown;
	try {
		parsed = JSON.parse(current);
	} catch {
		throw new Error('unauthorized');
	}
	if (isPlayerSession(parsed)) return parsed;
	if (
		parsed &&
		typeof parsed === 'object' &&
		'id' in parsed &&
		'token' in parsed &&
		parsed.id === null &&
		parsed.token === null
	)
		return null;
	throw new Error('unauthorized');
}

export async function withSessionLock<T>(run: () => Promise<T>): Promise<T> {
	return navigator.locks
		? navigator.locks.request('checkers.playerSession', run)
		: run();
}

export function storePlayerSession(session: PlayerSession) {
	if (!isPlayerSession(session)) throw new Error('network');
	let current: string;
	try {
		current = snapshot();
	} catch {
		throw new Error('storage');
	}
	if (observed !== undefined && observed !== current)
		throw new Error('session_changed');
	try {
		localStorage.setItem('checkers.previousPlayerSession', current);
		localStorage.setItem(sessionKey, JSON.stringify(session));
	} catch {
		throw new Error('storage');
	}
	observed = JSON.stringify(session);
}
