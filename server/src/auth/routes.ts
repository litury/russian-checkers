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
		const recovery = path.startsWith('/auth/recovery/');
		const routePath = recovery
			? path.replace('/auth/recovery/', '/auth/email/')
			: path;
		if (
			!(
				(req.method === 'GET' && routePath === '/auth/email/status') ||
				(req.method === 'POST' &&
					(routePath === '/auth/email/start' ||
						routePath === '/auth/email/confirm'))
			)
		)
			return false;
		res.setHeader('cache-control', 'no-store');
		const player = recovery
			? null
			: await _auth.playerFromAuth(req.headers.authorization);
		if (!player && !recovery) {
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
					if (recovery && body.purpose !== 'login')
						throw new EmailError(401, 'unauthorized');
					json(
						res,
						202,
						await _email.startAsync(player, email, body.purpose, ipOf(req)),
					);
				} else {
					if (
						recovery &&
						(typeof body.recoveryToken !== 'string' ||
							!/^[\w-]{32}$/.test(body.recoveryToken))
					)
						throw new EmailError(400, 'invalid_code');
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
							recovery ? (body.recoveryToken as string) : undefined,
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
