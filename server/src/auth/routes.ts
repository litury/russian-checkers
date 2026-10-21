import { randomInt } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Pool } from 'pg';
import type { AuthService } from '../auth/service.ts';
import { hashToken, json, read } from '../transport/http.ts';
import type { RateLimiter } from '../transport/rateLimit.ts';

export function createAuthRoutes(
	pool: Pool,
	auth: AuthService,
	limited: RateLimiter,
) {
	const { playerFromAuth } = auth;
	return async (
		req: IncomingMessage,
		res: ServerResponse,
		path: string,
	): Promise<boolean> => {
		if (req.method === 'POST' && path === '/auth/email/start') {
			const playerId = await playerFromAuth(req.headers.authorization);
			if (!playerId) {
				json(res, 401, { error: 'unauthorized' });
				return true;
			}
			if (limited(`e:${playerId}`, 5)) {
				json(res, 429, { error: 'rate' });
				return true;
			}
			const email = String(JSON.parse((await read(req)) || '{}').email ?? '')
				.trim()
				.toLowerCase();
			if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
				json(res, 400, { error: 'bad_email' });
				return true;
			}
			const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
			await pool.query(
				`INSERT INTO email_codes (email, code_hash, player_id, expires_at)
     VALUES ($1,$2,$3, now() + interval '10 minutes')
     ON CONFLICT (email) DO UPDATE SET code_hash=$2, player_id=$3, expires_at=now()+interval '10 minutes'`,
				[email, hashToken(code), playerId],
			);
			writeFileSync(
				'/tmp/checkers-email-code.txt',
				`${email} ${code}\n`,
				'utf8',
			);
			process.stdout.write(`email-code ${email} ${code}\n`);
			json(res, 200, { ok: true, dev: true });
			return true;
		}
		if (req.method === 'POST' && path === '/auth/email/confirm') {
			const playerId = await playerFromAuth(req.headers.authorization);
			if (!playerId) {
				json(res, 401, { error: 'unauthorized' });
				return true;
			}
			const body = JSON.parse((await read(req)) || '{}') as {
				email?: string;
				code?: string;
			};
			const email = String(body.email ?? '')
				.trim()
				.toLowerCase();
			const row = await pool.query(
				`SELECT * FROM email_codes WHERE email=$1 AND code_hash=$2 AND expires_at > now()`,
				[email, hashToken(String(body.code ?? ''))],
			);
			if (!row.rows[0] || row.rows[0].player_id !== playerId) {
				json(res, 400, { error: 'bad_code' });
				return true;
			}
			const taken = await pool.query(
				`SELECT player_id FROM auth_identities WHERE kind='email' AND email=$1`,
				[email],
			);
			if (taken.rows[0] && taken.rows[0].player_id !== playerId) {
				json(res, 409, {
					error: 'link_conflict',
					playerId: taken.rows[0].player_id,
				});
				return true;
			}
			await pool.query(
				`INSERT INTO auth_identities (player_id, kind, email) VALUES ($1,'email',$2)
     ON CONFLICT DO NOTHING`,
				[playerId, email],
			);
			await pool.query(`DELETE FROM email_codes WHERE email=$1`, [email]);
			json(res, 200, { ok: true, playerId });
			return true;
		}
		return false;
	};
}
