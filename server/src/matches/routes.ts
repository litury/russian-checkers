import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Pool } from 'pg';
import {
	type RecordedPly,
	replayPlies,
} from '../../../shared/protocol/replay.ts';
import type { Side } from '../../../shared/rules/index.ts';
import type { AuthService } from '../auth/service.ts';
import { json, read } from '../transport/http.ts';
import { isTimeControl } from '../../../shared/rules/timeControl.ts';

export function createMatchesRoutes(pool: Pool, auth: AuthService) {
	const { playerFromAuth } = auth;
	return async (
		req: IncomingMessage,
		res: ServerResponse,
		path: string,
	): Promise<boolean> => {
		if (req.method === 'GET' && path === '/matches') {
			const playerId = await playerFromAuth(req.headers.authorization);
			if (!playerId) {
				json(res, 401, { error: 'unauthorized' });
				return true;
			}
			const rows = await pool.query(
				`SELECT m.id, m.mode, m.winner, m.started_at, m.white_id, m.black_id, m.time_control,
      (SELECT count(*)::int FROM match_plies p WHERE p.match_id = m.id) AS plies
     FROM matches m
     WHERE m.white_id = $1 OR m.black_id = $1
     ORDER BY m.started_at DESC
     LIMIT 50`,
				[playerId],
			);
			json(res, 200, {
				matches: rows.rows.map(
					(r: {
						id: string;
						mode: string;
						winner: string | null;
						started_at: Date;
						white_id: string | null;
						black_id: string | null;
						plies: number;
						time_control: string;
					}) => ({
						id: r.id,
						mode: r.mode,
						timeControl: r.time_control,
						winner: r.winner,
						startedAt: r.started_at,
						color: r.white_id === playerId ? 'white' : 'black',
						plies: Number(r.plies ?? 0),
					}),
				),
			});
			return true;
		}
		if (req.method === 'GET' && path.startsWith('/matches/')) {
			const playerId = await playerFromAuth(req.headers.authorization);
			if (!playerId) {
				json(res, 401, { error: 'unauthorized' });
				return true;
			}
			const id = path.slice('/matches/'.length);
			if (!/^[0-9a-f-]{36}$/i.test(id)) {
				json(res, 404, { error: 'not_found' });
				return true;
			}
			const row = await pool.query(
				`SELECT id, mode, winner, started_at, white_id, black_id, time_control FROM matches WHERE id=$1`,
				[id],
			);
			const m = row.rows[0] as
				| {
						id: string;
						mode: string;
						time_control: string;
						winner: string | null;
						started_at: Date;
						white_id: string | null;
						black_id: string | null;
				  }
				| undefined;
			if (!m || (m.white_id !== playerId && m.black_id !== playerId)) {
				json(res, 404, { error: 'not_found' });
				return true;
			}
			const plies = await pool.query(
				`SELECT ply, side, from_sq, path FROM match_plies WHERE match_id=$1 ORDER BY ply`,
				[id],
			);
			json(res, 200, {
				id: m.id,
				mode: m.mode,
				timeControl: m.time_control,
				winner: m.winner,
				startedAt: m.started_at,
				color: m.white_id === playerId ? 'white' : 'black',
				plies: plies.rows.length,
				pliesList: plies.rows.map(
					(p: { side: string; from_sq: string; path: string }) => {
						let path: string[] = [];
						try {
							path = JSON.parse(p.path) as string[];
						} catch {
							path = [];
						}
						return { side: p.side, from: p.from_sq, path };
					},
				),
			});
			return true;
		}
		if (req.method === 'POST' && path === '/matches') {
			const playerId = await playerFromAuth(req.headers.authorization);
			if (!playerId) {
				json(res, 401, { error: 'unauthorized' });
				return true;
			}
			const body = JSON.parse((await read(req)) || '{}') as {
				mode?: string;
				timeControl?: unknown;
				humanSide?: Side;
				winner?: Side | 'draw';
				plies?: RecordedPly[];
			};
			if (
				body.mode !== 'bot' ||
				(body.humanSide !== 'white' && body.humanSide !== 'black')
			) {
				json(res, 400, { error: 'bad_match' });
				return true;
			}
			if (
				body.winner !== 'white' &&
				body.winner !== 'black' &&
				body.winner !== 'draw'
			) {
				json(res, 400, { error: 'bad_winner' });
				return true;
			}
			const plies = Array.isArray(body.plies) ? body.plies : [];
			if (body.timeControl !== undefined && !isTimeControl(body.timeControl)) {
				json(res, 400, { error: 'bad_time_control' });
				return true;
			}
			const replayed = replayPlies(plies);
			if (!replayed.ok) {
				json(res, 400, { error: 'illegal_ply', ply: replayed.ply });
				return true;
			}
			const whiteId = body.humanSide === 'white' ? playerId : null;
			const blackId = body.humanSide === 'black' ? playerId : null;
			const inserted = await pool.query(
				`INSERT INTO matches (mode, white_id, black_id, winner, time_control, ended_at) VALUES ('bot', $1, $2, $3, $4, now()) RETURNING id`,
				[whiteId, blackId, body.winner, body.timeControl ?? '1+0'],
			);
			const matchId = inserted.rows[0].id as string;
			let ply = 0;
			for (const step of plies) {
				ply += 1;
				await pool.query(
					`INSERT INTO match_plies (match_id, ply, side, from_sq, path) VALUES ($1,$2,$3,$4,$5)`,
					[matchId, ply, step.side, step.from, JSON.stringify(step.path)],
				);
			}
			json(res, 201, { id: matchId, winner: body.winner, plies: ply });
			return true;
		}
		return false;
	};
}
