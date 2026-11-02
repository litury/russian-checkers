import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import { hashToken } from '../transport/http.ts';
import {
	type EmailConfig,
	emailDigest,
	encryptEmail,
	matchesCode,
} from './emailCrypto.ts';

export type EmailPurpose = 'link' | 'login';
export class EmailError extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
	) {
		super(code);
	}
}

export function normalizeEmail(_value: unknown): string | null {
	if (typeof _value !== 'string') return null;
	const email = _value.trim().toLowerCase();
	if (
		email.length > 254 ||
		!/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]{1,64}@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,63}$/.test(
			email,
		)
	)
		return null;
	if (email.includes('..') || email.startsWith('.') || email.includes('.@'))
		return null;
	return email;
}

async function transactionAsync<T>(
	_pool: Pool,
	_run: (_client: PoolClient) => Promise<T>,
): Promise<T> {
	const client = await _pool.connect();
	try {
		await client.query('BEGIN');
		const result = await _run(client);
		await client.query('COMMIT');
		return result;
	} catch (error) {
		await client.query('ROLLBACK');
		throw error;
	} finally {
		client.release();
	}
}

export function createEmailService(_pool: Pool, _config: EmailConfig | null) {
	async function limitAsync(
		_client: PoolClient,
		_key: string,
		_max: number,
		_seconds: number,
	) {
		const result = await _client.query(
			`INSERT INTO email_rate_limits (key, hits, expires_at)
VALUES ($1,1,now()+$2*interval '1 second') ON CONFLICT (key) DO UPDATE SET
hits=CASE WHEN email_rate_limits.expires_at<=now() THEN 1 ELSE email_rate_limits.hits+1 END,
expires_at=CASE WHEN email_rate_limits.expires_at<=now() THEN EXCLUDED.expires_at ELSE email_rate_limits.expires_at END
RETURNING hits`,
			[_key, _seconds],
		);
		return result.rows[0].hits <= _max;
	}
	return {
		async statusAsync(_player: string) {
			const result = await _pool.query(
				"SELECT email FROM auth_identities WHERE player_id=$1 AND kind='email'",
				[_player],
			);
			return {
				available: Boolean(_config),
				email: result.rows[0]?.email ?? null,
			};
		},
		async startAsync(
			_requester: string,
			_email: string,
			_purpose: EmailPurpose,
			_ip: string,
		) {
			if (!_config) throw new EmailError(503, 'email_unavailable');
			const config = _config;
			const allowed = await transactionAsync(_pool, async (client) => {
				for (const [key, max, seconds] of [
					[`ip:${_ip}`, 20, 3600],
					[`player:${_requester}`, 5, 3600],
					[`email-hour:${_email}`, 5, 3600],
					[`email-minute:${_email}`, 1, 60],
				] as const) {
					if (
						!(await limitAsync(
							client,
							emailDigest(config, `rate:${key}`),
							max,
							seconds,
						))
					)
						return false;
				}
				return true;
			});
			if (!allowed) throw new EmailError(429, 'rate');
			const id = randomUUID();
			const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
			await transactionAsync(_pool, async (client) => {
				await client.query('SELECT id FROM players WHERE id=$1 FOR UPDATE', [
					_requester,
				]);
				const identities = await client.query(
					"SELECT player_id,email FROM auth_identities WHERE kind='email' AND (email=$1 OR player_id=$2)",
					[_email, _requester],
				);
				const owner = identities.rows.find((row) => row.email === _email)
					?.player_id as string | undefined;
				const ownEmail = identities.rows.find(
					(row) => row.player_id === _requester,
				)?.email;
				const target =
					_purpose === 'login'
						? owner
						: !ownEmail && !owner
							? _requester
							: undefined;
				await client.query(
					'UPDATE email_challenges SET consumed_at=now() WHERE requester_id=$1 AND consumed_at IS NULL',
					[_requester],
				);
				await client.query(
					`INSERT INTO email_challenges (id,requester_id,target_id,purpose,email,code_hash,expires_at)
VALUES ($1,$2,$3,$4,$5,$6,now()+interval '10 minutes')`,
					[
						id,
						_requester,
						target ?? null,
						_purpose,
						_email,
						emailDigest(config, `code:${id}:${code}`),
					],
				);
				if (target)
					await client.query(
						`INSERT INTO email_outbox (id,payload,expires_at)
SELECT id,$2,expires_at FROM email_challenges WHERE id=$1`,
						[
							id,
							encryptEmail(config, { email: _email, code, purpose: _purpose }),
						],
					);
			});
			return { challengeId: id, expiresIn: 600, retryAfter: 60 };
		},
		async confirmAsync(
			_requester: string,
			_id: string,
			_code: string,
			_ip: string,
		) {
			if (!_config) throw new EmailError(503, 'email_unavailable');
			const config = _config;
			const allowed = await transactionAsync(_pool, (client) =>
				limitAsync(client, emailDigest(config, `confirm:${_ip}`), 60, 3600),
			);
			if (!allowed) throw new EmailError(429, 'rate');
			const result = await transactionAsync(_pool, async (client) => {
				await client.query('SELECT id FROM players WHERE id=$1 FOR UPDATE', [
					_requester,
				]);
				const found = await client.query(
					`SELECT *,expires_at>now() AS valid FROM email_challenges
WHERE id=$1 AND requester_id=$2 FOR UPDATE`,
					[_id, _requester],
				);
				const challenge = found.rows[0];
				if (
					!challenge?.valid ||
					challenge.consumed_at ||
					challenge.attempts >= 5
				)
					return null;
				await client.query(
					'UPDATE email_challenges SET attempts=attempts+1 WHERE id=$1',
					[_id],
				);
				if (
					!matchesCode(config, _id, _code, challenge.code_hash) ||
					!challenge.target_id
				)
					return null;
				await client.query(
					'UPDATE email_challenges SET consumed_at=now() WHERE id=$1',
					[_id],
				);
				if (challenge.purpose === 'link') {
					const linked = await client.query(
						`INSERT INTO auth_identities (player_id,kind,email)
VALUES ($1,'email',$2) ON CONFLICT DO NOTHING RETURNING id`,
						[_requester, challenge.email],
					);
					return linked.rowCount
						? { linked: true as const, id: _requester }
						: null;
				}
				const owner = await client.query(
					"SELECT player_id FROM auth_identities WHERE kind='email' AND email=$1",
					[challenge.email],
				);
				if (owner.rows[0]?.player_id !== challenge.target_id) return null;
				const token = randomBytes(24).toString('base64url');
				await client.query(
					"INSERT INTO auth_identities (player_id,kind,token_hash) VALUES ($1,'device',$2)",
					[challenge.target_id, hashToken(token)],
				);
				return {
					linked: false as const,
					id: challenge.target_id as string,
					token,
				};
			});
			if (!result) throw new EmailError(400, 'invalid_code');
			return result;
		},
	};
}
