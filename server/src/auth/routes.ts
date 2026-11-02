import type { IncomingMessage, ServerResponse } from 'node:http';
import { ipOf, json, read } from '../transport/http.ts';
import {
	type createEmailService,
	EmailError,
	normalizeEmail,
} from './emailService.ts';
import type { AuthService } from './service.ts';

export function createAuthRoutes(
	_auth: AuthService,
	_email: ReturnType<typeof createEmailService>,
) {
	return async (
		req: IncomingMessage,
		res: ServerResponse,
		path: string,
	): Promise<boolean> => {
		if (
			!(
				(req.method === 'GET' && path === '/auth/email/status') ||
				(req.method === 'POST' &&
					(path === '/auth/email/start' || path === '/auth/email/confirm'))
			)
		)
			return false;
		res.setHeader('cache-control', 'no-store');
		const player = await _auth.playerFromAuth(req.headers.authorization);
		if (!player) {
			json(res, 401, { error: 'unauthorized' });
			return true;
		}
		try {
			if (req.method === 'GET')
				json(res, 200, await _email.statusAsync(player));
			else {
				let body: Record<string, unknown>;
				try {
					body = JSON.parse(await read(req, 4096));
				} catch (error) {
					if (!(error instanceof SyntaxError)) throw error;
					throw new EmailError(400, 'invalid_request');
				}
				if (!body || typeof body !== 'object' || Array.isArray(body))
					throw new EmailError(400, 'invalid_request');
				if (path.endsWith('/start')) {
					const email = normalizeEmail(body.email);
					if (!email || (body.purpose !== 'link' && body.purpose !== 'login'))
						throw new EmailError(400, 'invalid_email');
					json(
						res,
						202,
						await _email.startAsync(player, email, body.purpose, ipOf(req)),
					);
				} else {
					if (
						typeof body.challengeId !== 'string' ||
						!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
							body.challengeId,
						) ||
						typeof body.code !== 'string' ||
						!/^\d{6}$/.test(body.code)
					)
						throw new EmailError(400, 'invalid_code');
					json(
						res,
						200,
						await _email.confirmAsync(
							player,
							body.challengeId,
							body.code,
							ipOf(req),
						),
					);
				}
			}
		} catch (error) {
			if (error instanceof EmailError)
				json(res, error.status, { error: error.code });
			else throw error;
		}
		return true;
	};
}
