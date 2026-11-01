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
import type { RateLimiter } from '../transport/rateLimit.ts';
import { isClockBanks, type ClockBanks } from '../../../shared/protocol/clockBanks.ts';

export function createMatchesRoutes(pool: Pool, auth: AuthService, _limited: RateLimiter) {
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
				`SELECT m.id, m.mode, m.winner, m.end_reason, m.started_at, m.white_id, m.black_id, m.time_control,
      (SELECT count(*)::int FROM match_plies p WHERE p.match_id = m.id) AS plies
     FROM matches m
     WHERE (m.white_id = $1 OR m.black_id = $1) AND m.ended_at IS NOT NULL
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
						end_reason: string | null;
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
						endReason: r.end_reason,
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
				`SELECT id, mode, winner, end_reason, started_at, white_id, black_id, time_control FROM matches WHERE id=$1`,
				[id],
			);
			const m = row.rows[0] as
				| {
						id: string;
						mode: string;
						time_control: string;
						winner: string | null;
						end_reason: string | null;
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
				`SELECT ply, side, from_sq, path, clocks FROM match_plies WHERE match_id=$1 ORDER BY ply`,
				[id],
			);
			json(res, 200, {
				id: m.id,
				mode: m.mode,
				timeControl: m.time_control,
				winner: m.winner,
				endReason: m.end_reason,
				startedAt: m.started_at,
				color: m.white_id === playerId ? 'white' : 'black',
				plies: plies.rows.length,
				pliesList: plies.rows.map(
					(p: { side: string; from_sq: string; path: string; clocks: unknown }) => {
						let path: string[] = [];
						try {
							path = JSON.parse(p.path) as string[];
						} catch {
							path = [];
						}
						return { side: p.side, from: p.from_sq, path, clocks: isClockBanks(p.clocks) ? p.clocks : null };
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
			if (_limited(`record:${playerId}`, 30)) {
				res.setHeader('Retry-After', '60');
				json(res, 429, { error: 'rate' });
				return true;
			}
			const raw = await read(req);
			let body: {
				mode?: string;
				timeControl?: unknown;
				humanSide?: Side;
				winner?: Side | 'draw';
				endReason?: unknown;
				plies?: unknown;
			};
			try {
				body = JSON.parse(raw);
			} catch {
				json(res, 400, { error: 'bad_json' });
				return true;
			}
			if (
				!body || typeof body !== 'object' ||
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
			const plies = body.plies;
			if (!Array.isArray(plies) || plies.length > 1024 || !plies.every((step): step is RecordedPly & { clocks?: ClockBanks } =>
				step && typeof step === 'object' &&
				(step.side === 'white' || step.side === 'black') &&
				typeof step.from === 'string' && /^[a-h][1-8]$/.test(step.from) &&
				Array.isArray(step.path) && step.path.length > 0 && step.path.length <= 32 &&
				step.path.every((square: unknown) => typeof square === 'string' && /^[a-h][1-8]$/.test(square))
				&& (step.clocks === undefined || isClockBanks(step.clocks)),
			)) {
				json(res, 400, { error: 'bad_plies' });
				return true;
			}
			if (body.timeControl !== undefined && !isTimeControl(body.timeControl)) {
				json(res, 400, { error: 'bad_time_control' });
				return true;
			}
			const replayed = replayPlies(plies);
			if (body.endReason !== undefined && (typeof body.endReason !== 'string' || !['rules', 'flag', 'resign'].includes(body.endReason))) {
				json(res, 400, { error: 'bad_reason' });
				return true;
			}
			if (!replayed.ok) {
				json(res, 400, { error: 'illegal_ply', ply: replayed.ply });
				return true;
			}
			if (replayed.winner && replayed.winner !== body.winner) {
				json(res, 400, { error: 'result_mismatch' });
				return true;
			}
			if (body.endReason === 'rules' && !replayed.winner) {
				json(res, 400, { error: 'result_mismatch' });
				return true;
			}
			const whiteId = body.humanSide === 'white' ? playerId : null;
			const blackId = body.humanSide === 'black' ? playerId : null;
			const connection = await pool.connect();
			let failed = false;
			try {
				await connection.query('BEGIN');
				const inserted = await connection.query(
					`INSERT INTO matches (mode, white_id, black_id, winner, time_control, end_reason, ended_at) VALUES ('bot', $1, $2, $3, $4, $5, now()) RETURNING id`,
					[whiteId, blackId, body.winner, body.timeControl ?? '1+0', replayed.drawReason ?? (replayed.winner ? 'rules' : body.endReason ?? null)],
				);
				const matchId = inserted.rows[0].id as string;
				let ply = 0;
				for (const step of plies) {
					ply += 1;
					await connection.query(
						`INSERT INTO match_plies (match_id, ply, side, from_sq, path, clocks) VALUES ($1,$2,$3,$4,$5,$6)`,
						[matchId, ply, step.side, step.from, JSON.stringify(step.path), step.clocks ? JSON.stringify(step.clocks) : null],
					);
				}
				await connection.query('COMMIT');
				json(res, 201, { id: matchId, winner: body.winner, plies: ply });
			} catch (error) {
				failed = true;
				try { await connection.query('ROLLBACK'); } catch {}
				throw error;
			} finally {
				connection.release(failed);
			}
			return true;
		}
		return false;
	};
}
