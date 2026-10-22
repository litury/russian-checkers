import type { IncomingMessage, ServerResponse } from 'node:http';
import { json } from '../transport/http.ts';

export function createAuthRoutes() {
	return async (
		req: IncomingMessage,
		res: ServerResponse,
		path: string,
	): Promise<boolean> => {
		if (
			req.method !== 'POST' ||
			(path !== '/auth/email/start' && path !== '/auth/email/confirm')
		)
			return false;
		json(res, 503, { error: 'email_unavailable' });
		return true;
	};
}
