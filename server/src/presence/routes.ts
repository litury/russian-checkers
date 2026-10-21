import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AuthService } from '../auth/service.ts';
import { json, read } from '../transport/http.ts';
import type { PresenceService } from './service.ts';

export function createPresenceRoutes(
	presence: PresenceService,
	auth: AuthService,
) {
	const { playerFromAuth } = auth;
	const { siteLive } = presence;
	return async (
		req: IncomingMessage,
		res: ServerResponse,
		path: string,
	): Promise<boolean> => {
		if (
			req.method === 'GET' &&
			(path === '/stats/presence' || path === '/presence')
		) {
			const live = siteLive();
			json(res, 200, { live });
			return true;
		}
		if (
			req.method === 'POST' &&
			(path === '/stats/presence' || path === '/presence')
		) {
			const playerId = await playerFromAuth(req.headers.authorization);
			if (!playerId) {
				json(res, 401, { error: 'auth' });
				return true;
			}
			let on = true;
			let tab = '';
			try {
				const body = JSON.parse((await read(req)) || '{}') as {
					on?: unknown;
					tab?: unknown;
				};
				if (body.on === false) on = false;
				if (
					typeof body.tab === 'string' &&
					body.tab.length > 0 &&
					body.tab.length < 80
				)
					tab = body.tab;
			} catch {}
			const key = `${playerId}:${tab || 'tab'}`;
			if (on) presence.touch(key);
			else presence.drop(key);

			json(res, 200, { live: siteLive() });
			return true;
		}
		return false;
	};
}
