import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { decryptEmail, type EmailConfig } from './emailCrypto.ts';
import {
	EmailDeliveryError,
	type EmailMessage,
	sendEmailAsync,
} from './emailDelivery.ts';

export function createEmailOutbox(
	_pool: Pool,
	_config: EmailConfig | null,
	_send = sendEmailAsync,
) {
	let timer: ReturnType<typeof setInterval> | undefined;
	let running: Promise<void> | undefined;
	async function processAsync() {
		if (!_config) return;
		await _pool.query(`UPDATE email_outbox SET state='expired',payload=NULL,lease_id=NULL
WHERE state IN ('pending','sending') AND (expires_at<=now() OR EXISTS
(SELECT 1 FROM email_challenges WHERE id=email_outbox.id AND consumed_at IS NOT NULL))`);
		await _pool.query(`UPDATE email_outbox SET state='failed',payload=NULL,lease_id=NULL,last_error='attempt_limit'
WHERE state IN ('pending','sending') AND attempts>=6 AND available_at<=now()`);
		await _pool.query(
			"DELETE FROM email_challenges WHERE expires_at<now()-interval '1 day'",
		);
		await _pool.query('DELETE FROM email_rate_limits WHERE expires_at<now()');
		const lease = randomUUID();
		const claimed = await _pool.query(
			`WITH next AS (
SELECT id FROM email_outbox WHERE state IN ('pending','sending') AND available_at<=now()
AND expires_at>now() AND attempts<6 ORDER BY available_at LIMIT 1 FOR UPDATE SKIP LOCKED)
UPDATE email_outbox SET state='sending',attempts=attempts+1,lease_id=$1,available_at=now()+interval '30 seconds'
FROM next WHERE email_outbox.id=next.id RETURNING email_outbox.*`,
			[lease],
		);
		const job = claimed.rows[0];
		if (!job) return;
		let providerId: string;
		try {
			const message = decryptEmail(_config, job.payload) as EmailMessage;
			if (
				!/^\d{6}$/.test(message.code) ||
				!['link', 'login'].includes(message.purpose) ||
				typeof message.email !== 'string'
			) {
				throw new EmailDeliveryError(false, 'payload');
			}
			providerId = await _send(_config, job.id, message);
		} catch (error) {
			const retry =
				error instanceof EmailDeliveryError &&
				error.retryable &&
				job.attempts < 6;
			await _pool.query(
				`UPDATE email_outbox SET state=$3,last_error=$4,lease_id=NULL,
payload=CASE WHEN $3='failed' THEN NULL ELSE payload END,available_at=now()+$5*interval '1 second'
WHERE id=$1 AND lease_id=$2`,
				[
					job.id,
					lease,
					retry ? 'pending' : 'failed',
					error instanceof EmailDeliveryError
						? error.category
						: 'delivery_failed',
					Math.min(120, 5 * 2 ** job.attempts),
				],
			);
			return;
		}
		await _pool.query(
			"UPDATE email_outbox SET state='sent',payload=NULL,provider_id=$3,lease_id=NULL,last_error=NULL WHERE id=$1 AND lease_id=$2",
			[job.id, lease, providerId],
		);
	}
	function tickAsync(): Promise<void> {
		if (running) return running;
		running = processAsync().finally(() => {
			running = undefined;
		});
		return running;
	}
	return {
		tickAsync,
		start() {
			if (!_config || timer) return;
			const tick = () => {
				void tickAsync().catch(() =>
					process.stderr.write('email outbox temporarily unavailable\n'),
				);
			};
			timer = setInterval(tick, 2000);
			timer.unref();
			tick();
		},
		async stopAsync() {
			clearInterval(timer);
			timer = undefined;
			await running?.catch(() => undefined);
		},
	};
}
