import { randomBytes } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Pool } from 'pg';
import { hashToken, ipOf, json } from '../transport/http.ts';
import type { RateLimiter } from '../transport/rateLimit.ts';

export function createPlayersRoutes(pool: Pool, limited: RateLimiter) {
	return async (
		req: IncomingMessage,
		res: ServerResponse,
		path: string,
	): Promise<boolean> => {
		if (req.method === 'POST' && path === '/players/guest') {
			if (limited(`g:${ipOf(req)}`, 32)) {
				json(res, 429, { error: 'rate' });
				return true;
			}
			const token = randomBytes(24).toString('base64url');
			const h = hashToken(token);
			const created = await pool.query(
				'INSERT INTO players (token_hash) VALUES ($1) RETURNING id, created_at',
				[h],
			);
			const id = created.rows[0].id as string;
			await pool.query(
				`INSERT INTO auth_identities (player_id, kind, token_hash) VALUES ($1,'device',$2)`,
				[id, h],
			);
			json(res, 201, { id, token, createdAt: created.rows[0].created_at });
			return true;
		}
		if (
			req.method === 'GET' &&
			path.startsWith('/players/') &&
			path.endsWith('/stats')
		) {
			const id = path.slice('/players/'.length, -'/stats'.length);
			const stats = await pool.query(
				`SELECT
      count(*) FILTER (WHERE winner IS NOT NULL)::int AS games,
      count(*) FILTER (WHERE winner = 'white' AND white_id = $1)::int AS white_wins,
      count(*) FILTER (WHERE winner = 'black' AND black_id = $1)::int AS black_wins,
      count(*) FILTER (WHERE mode = 'bot' AND winner IS NOT NULL)::int AS bot_games,
      count(*) FILTER (WHERE mode = 'online' AND winner IS NOT NULL)::int AS online_games
     FROM matches WHERE white_id = $1 OR black_id = $1`,
				[id],
			);
			json(res, 200, { playerId: id, ...stats.rows[0] });
			return true;
		}
		return false;
	};
}
