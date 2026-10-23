import type { Pool } from 'pg';
import type { RecordedPly } from '../../../shared/protocol/replay.ts';
import type { Side } from '../../../shared/rules/index.ts';
import type { SelectableTimeControl } from '../../../shared/rules/timeControl.ts';
import type { MatchRuntime } from './runtime.ts';
export function createMatchRepository(pool: Pool) {
	return {
		async completed(id: string, player: string): Promise<{ winner: Side | 'draw'; reason: string; runtime: MatchRuntime } | null> {
			const result = await pool.query(
				'SELECT winner,end_reason AS reason,runtime FROM matches WHERE id::text=$1 AND (white_id=$2 OR black_id=$2) AND ended_at IS NOT NULL AND runtime IS NOT NULL',
				[id, player],
			);
			return result.rows[0] ?? null;
		},
		async active(): Promise<{ id: string; runtime: MatchRuntime }[]> {
			const result = await pool.query(
				'SELECT id,runtime FROM matches WHERE ended_at IS NULL AND runtime IS NOT NULL',
			);
			return result.rows;
		},
		async save(id: string, runtime: MatchRuntime, ply?: RecordedPly): Promise<void> {
			const connection = await pool.connect();
			try {
				await connection.query('BEGIN');
				const updated = await connection.query(
					'UPDATE matches SET runtime=$2,black_id=$3 WHERE id=$1 AND ended_at IS NULL RETURNING id',
					[id, JSON.stringify(runtime), runtime.black || null],
				);
				if (updated.rowCount !== 1) throw new Error('Match is no longer active');
				if (ply) await connection.query(
					'INSERT INTO match_plies (match_id,ply,side,from_sq,path) VALUES ($1,$2,$3,$4,$5)',
					[id, runtime.ply, ply.side, ply.from, JSON.stringify(ply.path)],
				);
				await connection.query('COMMIT');
			} catch (error) {
				await connection.query('ROLLBACK');
				throw error;
			} finally {
				connection.release();
			}
		},
		async open(
			white: string,
			black: string,
			timeControl: SelectableTimeControl,
		): Promise<string> {
			const result = await pool.query(
				"INSERT INTO matches (mode,white_id,black_id,time_control) VALUES ('online',$1,$2,$3) RETURNING id",
				[white, black || null, timeControl],
			);
			return result.rows[0].id as string;
		},
		async finish(id: string, winner: Side | 'draw', reason: string, runtime: MatchRuntime): Promise<void> {
			await pool.query(
				'UPDATE matches SET winner=$2,ended_at=now(),end_reason=$3,runtime=$4 WHERE id=$1 AND ended_at IS NULL',
				[id, winner, reason, JSON.stringify(runtime)],
			);
		},
	};
}
export type MatchRepository = ReturnType<typeof createMatchRepository>;
