import type { EmailConfig } from './emailCrypto.ts';
import type { EmailPurpose } from './emailService.ts';

export interface EmailMessage {
	email: string;
	code: string;
	purpose: EmailPurpose;
}

export class EmailDeliveryError extends Error {
	constructor(
		readonly retryable: boolean,
		readonly category: string,
	) {
		super(category);
	}
}

export function emailBody(_message: EmailMessage) {
	const title =
		_message.purpose === 'link' ? 'Подтвердите почту' : 'Вход в Русские шашки';
	const explanation =
		_message.purpose === 'link'
			? 'Введите код в игре, чтобы сохранить доступ к рейтингу и истории партий.'
			: 'Введите код в игре, чтобы войти в свой профиль.';
	return {
		subject: `${title} — damka.fun`,
		body: {
			plaintext: `${title}\n\n${explanation}\n\n${_message.code}\n\nКод действует 10 минут с момента запроса. Никому его не сообщайте.\nЕсли вы не запрашивали код, просто проигнорируйте это письмо.\n\nРусские шашки · damka.fun`,
			html: `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="margin:0;background:#f5f3ee;color:#262622;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 16px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background:#fff"><tr><td style="padding:28px"><p style="margin:0 0 24px;color:#655538">РУССКИЕ ШАШКИ</p><h1 style="font-size:24px;line-height:1.3">${title}</h1><p style="font-size:16px;line-height:1.6">${explanation}</p><p style="font-size:32px;font-weight:bold;letter-spacing:6px;padding:20px 8px;background:#f5f3ee;text-align:center">${_message.code}</p><p style="font-size:16px;line-height:1.6">Код действует 10 минут с момента запроса. Никому его не сообщайте.</p><p style="font-size:14px;line-height:1.6;color:#595959">Если вы не запрашивали код, просто проигнорируйте это письмо.</p><p style="font-size:14px;color:#655538">damka.fun</p></td></tr></table></td></tr></table></body></html>`,
		},
	};
}

export async function sendEmailAsync(
	_config: EmailConfig,
	_id: string,
	_message: EmailMessage,
): Promise<string> {
	let response: Response;
	try {
		response = await fetch(
			'https://goapi.unisender.ru/ru/transactional/api/v1/email/send.json',
			{
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'X-API-KEY': _config.apiKey,
				},
				body: JSON.stringify({
					message: {
						...emailBody(_message),
						recipients: [{ email: _message.email }],
						from_email: _config.from,
						from_name: 'Русские шашки',
						track_links: 0,
						track_read: 0,
						skip_unsubscribe: _config.skipUnsubscribe ? 1 : 0,
						global_language: 'ru',
						idempotence_key: _id,
					},
				}),
				signal: AbortSignal.timeout(10000),
			},
		);
	} catch {
		throw new EmailDeliveryError(true, 'network');
	}
	if (!response.ok)
		throw new EmailDeliveryError(
			response.status === 429 || response.status >= 500,
			`http_${response.status}`,
		);
	let result: { status?: string; job_id?: string; code?: number };
	try {
		result = await response.json();
	} catch {
		throw new EmailDeliveryError(true, 'response');
	}
	if (result.status !== 'success' || typeof result.job_id !== 'string') {
		throw new EmailDeliveryError(
			false,
			`api_${Number.isInteger(result.code) ? result.code : 'error'}`,
		);
	}
	return result.job_id;
}
