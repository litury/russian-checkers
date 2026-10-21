import type { IncomingMessage, ServerResponse } from 'node:http';
import { createServer } from 'node:http';
import type { Duplex } from 'node:stream';
import type { Pool } from 'pg';
import type { MatchService } from '../matches/service.ts';
import { acceptWebsocket } from '../wsRaw.ts';
import { json } from './http.ts';

type Route = (
	req: IncomingMessage,
	res: ServerResponse,
	path: string,
) => Promise<boolean>;
export function createApiServer(
	pool: Pool,
	matches: MatchService,
	routes: Route[],
) {
	const upgradedSockets = new Set<Duplex>();
	const server = createServer(async (req, res) => {
		if (req.method === 'OPTIONS') {
			res.writeHead(204, {
				'access-control-allow-origin': '*',
				'access-control-allow-headers': 'content-type, authorization',
				'access-control-allow-methods': 'GET,POST,OPTIONS',
			});
			res.end();
			return;
		}
		try {
			const path = req.url?.split('?')[0] ?? '/';
			if (req.method === 'GET' && path === '/health') {
				await pool.query('SELECT 1');
				json(res, 200, { ok: true, db: true, ...matches.status(), ws: '/ws' });
				return;
			}
			for (const route of routes) if (await route(req, res, path)) return;
			json(res, 404, { error: 'not_found' });
		} catch (error) {
			json(res, 500, {
				error: error instanceof Error ? error.message : 'server_error',
			});
		}
	});
	server.on('upgrade', (req, socket) => {
		if ((req.url ?? '').split('?')[0] !== '/ws') {
			socket.destroy();
			return;
		}
		const context: { player?: string } = {};
		const sock = acceptWebsocket(
			req,
			socket,
			(text) => {
				void matches
					.handleWs(sock!, text, context)
					.catch((error) => process.stderr.write('ws ' + error + '\n'));
			},
			() => {
				if (context.player && sock) matches.disconnect(context.player, sock);
			},
		);
		if (!sock) socket.destroy();
		else {
			upgradedSockets.add(socket);
			socket.once('close', () => {
				upgradedSockets.delete(socket);
			});
		}
	});
	return Object.assign(server, {
		closeWebSockets() {
			for (const socket of upgradedSockets) socket.destroy();
			upgradedSockets.clear();
		},
	});
}
