import type { Pool } from 'pg';
import type { RecordedPly } from '../../../shared/protocol/replay.ts';
import type { SelectableTimeControl } from '../../../shared/rules/timeControl.ts';
import type { MatchRuntime } from './runtime.ts';
import type { MatchResult } from '../../../shared/protocol/matchResult.ts';
import type { RatingChange } from '../../../shared/protocol/rating.ts';
import { rateMatch } from '../ratings/service.ts';

export interface StoredMatch {
	winner: MatchResult;
	reason: string;
	runtime: MatchRuntime;
	ended: boolean;
	ratingChanges?: Record<string, RatingChange> | null;
}

function stored(row: { winner: MatchResult | null; reason: string; runtime: MatchRuntime; ended: boolean }): StoredMatch {
	return { ...row, winner: row.winner ?? 'aborted' };
}

export function createMatchRepository(pool: Pool) {
	return {
		async read(id: string): Promise<StoredMatch> {
			const result = await pool.query(
				'SELECT winner,end_reason AS reason,runtime,ended_at IS NOT NULL AS ended FROM matches WHERE id=$1 FOR UPDATE',
				[id],
			);
			if (!result.rows[0]?.runtime) throw new Error('Match snapshot missing');
			return stored(result.rows[0]);
		},
		async completed(id: string, player: string): Promise<StoredMatch | null> {
			const result = await pool.query(
				'SELECT winner,end_reason AS reason,runtime,rating_changes AS "ratingChanges" FROM matches WHERE id::text=$1 AND (white_id=$2 OR black_id=$2) AND ended_at IS NOT NULL AND runtime IS NOT NULL',
				[id, player],
			);
			return result.rows[0] ? stored({ ...result.rows[0], ended: true }) : null;
		},
		async active(): Promise<{ id: string; runtime: MatchRuntime }[]> {
			const result = await pool.query(
				'SELECT id,runtime FROM matches WHERE ended_at IS NULL AND runtime IS NOT NULL',
			);
			return result.rows;
		},
		async save(id: string, runtime: MatchRuntime, ply?: RecordedPly): Promise<void> {
			const connection = await pool.connect();
			let failed = false;
			try {
				await connection.query('BEGIN');
				const updated = await connection.query(
					'UPDATE matches SET runtime=$2,black_id=$3 WHERE id=$1 AND ended_at IS NULL RETURNING id',
					[id, JSON.stringify(runtime), runtime.black || null],
				);
				if (updated.rowCount !== 1) throw new Error('Match is no longer active');
				if (ply) await connection.query(
					'INSERT INTO match_plies (match_id,ply,side,from_sq,path,clocks) VALUES ($1,$2,$3,$4,$5,$6)',
					[id, runtime.ply, ply.side, ply.from, JSON.stringify(ply.path), JSON.stringify(runtime.banks)],
				);
				await connection.query('COMMIT');
			} catch (error) {
				failed = true;
				try { await connection.query('ROLLBACK'); } catch {}
				throw error;
			} finally {
				connection.release(failed);
			}
		},
		async startClock(id: string, ply: number, turnStarted: number): Promise<void> {
			await pool.query(
				"UPDATE matches SET runtime=jsonb_set(jsonb_set(runtime,'{turnStarted}',to_jsonb($3::bigint)),'{clockPending}','false'::jsonb) WHERE id=$1 AND ended_at IS NULL AND (runtime->>'ply')::integer=$2 AND runtime->>'clockPending'='true'",
				[id, ply, turnStarted],
			);
		},
		async open(
			white: string,
			black: string,
			timeControl: SelectableTimeControl,
			rated = false,
		): Promise<string> {
			const result = await pool.query(
				"INSERT INTO matches (mode,white_id,black_id,time_control,rated) VALUES ('online',$1,$2,$3,$4) RETURNING id",
				[white, black || null, timeControl, rated],
			);
			return result.rows[0].id as string;
		},
		async finish(id: string, winner: MatchResult, reason: string, runtime: MatchRuntime): Promise<StoredMatch> {
			const connection = await pool.connect();
			let failed = false;
			try {
				await connection.query('BEGIN');
				const existing = await connection.query(
					'SELECT *,end_reason AS reason,rating_changes AS "ratingChanges",ended_at IS NOT NULL AS ended FROM matches WHERE id=$1 FOR UPDATE', [id],
				);
				const match = existing.rows[0];
				if (!match) throw new Error('Match result missing');
				if (match.ended) {
					await connection.query('COMMIT');
					return stored(match);
				}
				const eligible = match.rated && match.mode === 'online' && match.time_control === '3+2'
					&& runtime.begun && !runtime.friend && match.white_id && match.black_id
					&& match.white_id !== match.black_id && winner !== 'aborted';
				const ratingChanges = eligible
					? await rateMatch(connection, id, match.white_id, match.black_id, winner) : null;
				await connection.query(
					'UPDATE matches SET winner=$2,ended_at=now(),end_reason=$3,runtime=$4,rating_changes=$5 WHERE id=$1',
					[id, winner === 'aborted' ? null : winner, reason, JSON.stringify(runtime), JSON.stringify(ratingChanges)],
				);
				await connection.query('COMMIT');
				return { winner, reason, runtime, ended: true, ratingChanges };
			} catch (error) {
				failed = true;
				try { await connection.query('ROLLBACK'); } catch {}
				throw error;
			} finally {
				connection.release(failed);
			}
		},
	};
}
export type MatchRepository = ReturnType<typeof createMatchRepository>;
