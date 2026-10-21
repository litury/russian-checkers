import type { Pool } from 'pg';
import { hashToken } from '../transport/http.ts';
export function createAuthService(pool: Pool) {
	const playerFromAuth = async (header: string | undefined) => {
		const token = header?.startsWith('Bearer ') ? header.slice(7) : '';
		if (!token) return null;
		const h = hashToken(token);
		const idn = await pool.query(
			`SELECT player_id FROM auth_identities WHERE kind='device' AND token_hash=$1`,
			[h],
		);
		if (idn.rows[0]) return idn.rows[0].player_id as string;
		const old = await pool.query(`SELECT id FROM players WHERE token_hash=$1`, [
			h,
		]);
		return (old.rows[0]?.id as string | undefined) ?? null;
	};
	return { playerFromAuth };
}
export type AuthService = ReturnType<typeof createAuthService>;
