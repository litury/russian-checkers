import type { Pool } from 'pg';
import type { RecordedPly } from '../../../shared/protocol/replay.ts';
import type { Side } from '../../../shared/rules/index.ts';
export function createMatchRepository(pool: Pool) {
	return {
		async open(white: string, black: string): Promise<string> {
			const result = await pool.query(
				"INSERT INTO matches (mode,white_id,black_id) VALUES ('online',$1,$2) RETURNING id",
				[white, black || null],
			);
			return result.rows[0].id as string;
		},
		async finish(id: string, winner: Side | 'draw'): Promise<void> {
			await pool.query(
				'UPDATE matches SET winner=$2,ended_at=now() WHERE id=$1',
				[id, winner],
			);
		},
		async assignBlack(id: string, player: string): Promise<void> {
			await pool.query('UPDATE matches SET black_id=$2 WHERE id=$1', [
				id,
				player,
			]);
		},
		async appendPly(
			id: string,
			number: number,
			ply: RecordedPly,
		): Promise<void> {
			await pool.query(
				'INSERT INTO match_plies (match_id,ply,side,from_sq,path) VALUES ($1,$2,$3,$4,$5)',
				[id, number, ply.side, ply.from, JSON.stringify(ply.path)],
			);
		},
	};
}
export type MatchRepository = ReturnType<typeof createMatchRepository>;
