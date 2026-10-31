import { createHash } from 'node:crypto';
import { createClientIp } from './clientIp.ts';

type Res = import('node:http').ServerResponse;

export const json = (res: Res, code: number, body: unknown) => {
	res.writeHead(code, {
		'content-type': 'application/json; charset=utf-8',
		'access-control-allow-origin': '*',
		'access-control-allow-headers': 'content-type, authorization',
	});
	res.end(JSON.stringify(body));
};

export class RequestBodyTooLarge extends Error {}

export const read = (req: import('node:http').IncomingMessage, limit = 256 * 1024) =>
	new Promise<string>((resolve, reject) => {
		const chunks: Buffer[] = [];
		let size = 0;
		req.on('data', (chunk: Buffer) => {
			size += chunk.length;
			if (size > limit) {
				chunks.length = 0;
				reject(new RequestBodyTooLarge('Request body too large'));
				return;
			}
			chunks.push(chunk);
		});
		req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
		req.on('error', reject);
		req.on('aborted', () => reject(new Error('Request aborted')));
	});

export const hashToken = (token: string) =>
	createHash('sha256').update(token).digest('hex');

export const ipOf = createClientIp(process.env.TRUSTED_PROXY_CIDRS ?? '');
