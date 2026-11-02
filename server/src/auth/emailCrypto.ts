import {
	createCipheriv,
	createDecipheriv,
	createHmac,
	randomBytes,
	timingSafeEqual,
} from 'node:crypto';

export interface EmailConfig {
	apiKey: string;
	from: string;
	secret: Buffer;
	skipUnsubscribe?: boolean;
}

export function readEmailConfig(_env = process.env): EmailConfig | null {
	const apiKey = _env.UNISENDER_API_KEY?.trim();
	const from = _env.EMAIL_FROM?.trim();
	const encoded = _env.EMAIL_SECRET?.trim();
	if (!apiKey && !from && !encoded) return null;
	const secret = Buffer.from(encoded ?? '', 'base64');
	if (
		!apiKey ||
		!from ||
		!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(from) ||
		secret.length !== 32
	) {
		throw new Error(
			'Set UNISENDER_API_KEY, EMAIL_FROM and EMAIL_SECRET (32 random bytes, base64) together',
		);
	}
	return {
		apiKey,
		from,
		secret,
		skipUnsubscribe: _env.EMAIL_SKIP_UNSUBSCRIBE === '1',
	};
}

export function emailDigest(_config: EmailConfig, _value: string): string {
	return createHmac('sha256', _config.secret).update(_value).digest('hex');
}

export function matchesCode(
	_config: EmailConfig,
	_id: string,
	_code: string,
	_hash: string,
): boolean {
	const actual = Buffer.from(
		emailDigest(_config, `code:${_id}:${_code}`),
		'hex',
	);
	const expected = Buffer.from(_hash, 'hex');
	return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function encryptEmail(_config: EmailConfig, _value: unknown): string {
	const nonce = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', _config.secret, nonce);
	cipher.setAAD(Buffer.from('damka-email-v1'));
	const encrypted = Buffer.concat([
		cipher.update(JSON.stringify(_value), 'utf8'),
		cipher.final(),
	]);
	return Buffer.concat([nonce, cipher.getAuthTag(), encrypted]).toString(
		'base64',
	);
}

export function decryptEmail(_config: EmailConfig, _payload: string): unknown {
	const bytes = Buffer.from(_payload, 'base64');
	const cipher = createDecipheriv(
		'aes-256-gcm',
		_config.secret,
		bytes.subarray(0, 12),
	);
	cipher.setAAD(Buffer.from('damka-email-v1'));
	cipher.setAuthTag(bytes.subarray(12, 28));
	return JSON.parse(
		Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString(
			'utf8',
		),
	);
}
