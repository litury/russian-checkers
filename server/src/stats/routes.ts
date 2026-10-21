import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Pool } from 'pg';
import { json } from '../transport/http.ts';
import { COLOR_STATS_CACHE_MS, colorStatsSql } from './colorStats.ts';

export function createStatsRoutes(pool: Pool) {
	let colorStatsCache:
		| { at: number; body: { white: number; black: number; games: number } }
		| undefined;
	return async (
		req: IncomingMessage,
		res: ServerResponse,
		path: string,
	): Promise<boolean> => {
		if (req.method === 'GET' && path === '/stats/colors') {
			const now = Date.now();
			if (colorStatsCache && now - colorStatsCache.at < COLOR_STATS_CACHE_MS) {
				json(res, 200, colorStatsCache.body);
				return true;
			}
			const rows = await pool.query(colorStatsSql);
			const body = {
				white: Number(rows.rows[0]?.white ?? 0),
				black: Number(rows.rows[0]?.black ?? 0),
				games: Number(rows.rows[0]?.games ?? 0),
			};
			colorStatsCache = { at: now, body };
			json(res, 200, body);
			return true;
		}
		return false;
	};
}
