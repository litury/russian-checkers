import { createHash } from 'node:crypto';

type Res = import('node:http').ServerResponse;

export const json = (res: Res, code: number, body: unknown) => {
	res.writeHead(code, {
		'content-type': 'application/json; charset=utf-8',
		'access-control-allow-origin': '*',
		'access-control-allow-headers': 'content-type, authorization',
	});
	res.end(JSON.stringify(body));
};

export const read = (req: import('node:http').IncomingMessage) =>
	new Promise<string>((resolve, reject) => {
		const chunks: Buffer[] = [];
		req.on('data', (c) => chunks.push(c as Buffer));
		req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
		req.on('error', reject);
	});

export const hashToken = (token: string) =>
	createHash('sha256').update(token).digest('hex');

export const ipOf = (req: import('node:http').IncomingMessage) =>
	(
		req.headers['x-forwarded-for']?.toString().split(',')[0] ??
		req.socket.remoteAddress ??
		''
	).trim();
