import type { PoolClient } from 'pg';
import type {
	RatingChange,
	RatingSummary,
} from '../../../shared/protocol/rating.ts';
import {
	inactiveRating,
	initialRating,
	type Rating,
	updateRating,
} from './glicko2.ts';

export interface StoredRating extends Rating {
	player_id: string;
	games: number;
	updated_at: Date;
}

export function currentRating(player: StoredRating, now: number): Rating {
	return inactiveRating(
		player,
		(now - new Date(player.updated_at).getTime()) / 86_400_000,
	);
}

export function ratingSummary(
	player?: StoredRating,
	now = Date.now(),
): RatingSummary {
	const effective = player ? currentRating(player, now) : initialRating;
	return {
		rating: Math.round(effective.rating),
		games: player?.games ?? 0,
		provisional: effective.deviation > 110,
	};
}

export async function rateMatch(
	connection: PoolClient,
	matchId: string,
	white: string,
	black: string,
	winner: 'white' | 'black' | 'draw',
): Promise<Record<string, RatingChange>> {
	const ids = [white, black].sort();
	for (const id of ids)
		await connection.query(
			'INSERT INTO player_ratings (player_id) VALUES ($1) ON CONFLICT DO NOTHING',
			[id],
		);
	const rows = await connection.query<StoredRating>(
		'SELECT * FROM player_ratings WHERE player_id=ANY($1::uuid[]) ORDER BY player_id FOR UPDATE',
		[ids],
	);
	const time = await connection.query('SELECT clock_timestamp() AS now');
	const now = new Date(time.rows[0].now).getTime();
	const changes: Record<string, RatingChange> = {};
	for (const player of rows.rows) {
		const opponent = rows.rows.find(
			(other) => other.player_id !== player.player_id,
		);
		if (!opponent) throw new Error('Rating opponent missing');
		const score =
			winner === 'draw'
				? 0.5
				: (winner === 'white' ? white : black) === player.player_id
					? 1
					: 0;
		const next = updateRating(currentRating(player, now), [
			{ opponent: currentRating(opponent, now), score },
		]);
		const games = player.games + 1;
		await connection.query(
			'UPDATE player_ratings SET rating=$2,deviation=$3,volatility=$4,games=$5,updated_at=$6 WHERE player_id=$1',
			[
				player.player_id,
				next.rating,
				next.deviation,
				next.volatility,
				games,
				new Date(now),
			],
		);
		await connection.query(
			'INSERT INTO rating_ledger (match_id,player_id,opponent_id,algorithm,before_state,after_state,score) VALUES ($1,$2,$3,$4,$5,$6,$7)',
			[
				matchId,
				player.player_id,
				opponent.player_id,
				'glicko2-v1',
				JSON.stringify(player),
				JSON.stringify({ ...next, games, updated_at: new Date(now) }),
				score,
			],
		);
		const before = Math.round(player.rating);
		const after = Math.round(next.rating);
		changes[player.player_id] = {
			before,
			after,
			delta: after - before,
			provisional: next.deviation > 110,
		};
	}
	return changes;
}
