import {
	bothReady,
	hashPosition,
	READY_MS,
	snapshotOf,
} from '../../../shared/protocol/matchState.ts';
import type { RecordedPly } from '../../../shared/protocol/replay.ts';
import { applyPly } from '../../../shared/protocol/replay.ts';
import {
	afterMoveBank,
	blitzStartMs,
	createInitialPosition,
	type IPosition,
	resultSide,
	type Side,
} from '../../../shared/rules/index.ts';
import type { AuthService } from '../auth/service.ts';
import type { RateLimiter } from '../transport/rateLimit.ts';
import type { TextSock } from '../wsRaw.ts';
import { flagDue, flagWinner, turnLeft } from './flagClock.ts';
import { mintFriendCode, resolveFriendJoin } from './friendCode.ts';
import type { MatchRepository } from './repository.ts';
export function createMatchService(
	repository: MatchRepository,
	auth: AuthService,
	limited: RateLimiter,
) {
	const { playerFromAuth } = auth;
	const DROP_MS = 60_000;

	type Room = {
		id: string;
		white: string;
		black: string;
		position: IPosition;
		ply: number;
		keys: string[];
		begun: boolean;
		ready: Set<string>;
		readyTimer?: ReturnType<typeof setTimeout>;
		flagTimer?: ReturnType<typeof setTimeout>;
		banks: Record<Side, number>;
		turnStarted: number;
		socks: Map<string, TextSock>;
		drop: Map<string, ReturnType<typeof setTimeout>>;
		dropUntil?: number;
		friend: boolean;
	};

	const queue: { id: string; sock: TextSock }[] = [];

	const rooms = new Map<string, Room>();

	const friendCodes = new Map<string, string>();

	const playerRoom = new Map<string, string>();

	const send = (sock: TextSock | undefined, msg: unknown) => {
		if (sock) sock.send(JSON.stringify(msg));
	};

	const endRoom = async (
		room: Room,
		win: Side | 'draw',
		reason: string,
		loserId?: string,
	) => {
		if (!rooms.has(room.id)) return;
		rooms.delete(room.id);
		for (const [code, id] of friendCodes)
			if (id === room.id) friendCodes.delete(code);

		playerRoom.delete(room.white);
		playerRoom.delete(room.black);
		if (room.readyTimer) clearTimeout(room.readyTimer);
		if (room.flagTimer) clearTimeout(room.flagTimer);
		for (const t of room.drop.values()) clearTimeout(t);
		for (const [pid, sock] of room.socks) {
			const youWin = loserId
				? pid !== loserId
				: win !== 'draw' &&
					((win === 'white' && pid === room.white) ||
						(win === 'black' && pid === room.black));
			send(sock, { type: 'end', winner: win, youWin, reason });
		}
		try {
			await repository.finish(room.id, win);
		} catch (err) {
			process.stderr.write(`endRoom db ${err}\n`);
		}
	};

	const otherOf = (room: Room, id: string): Side =>
		id === room.white ? 'black' : 'white';

	const clockFields = (room: Room) => ({
		banks: { white: room.banks.white, black: room.banks.black },
		turnStarted: room.turnStarted,
		paused: room.drop.size > 0,
		serverNow: Date.now(),
		dropUntil: room.drop.size > 0 ? (room.dropUntil ?? 0) : 0,
	});

	const pushState = (room: Room, sock: TextSock | undefined, color?: Side) => {
		const snap = snapshotOf(
			room.id,
			room.position,
			room.ply,
			room.begun,
			clockFields(room),
		);
		send(sock, { type: 'state', color, ...snap, ...clockFields(room) });
	};

	const flagRoom = (room: Room) => {
		const loser = room.position.turn;
		const loserId = loser === 'white' ? room.white : room.black;
		void endRoom(room, flagWinner(loser), 'flag', loserId);
	};

	const armFlag = (room: Room) => {
		if (room.flagTimer) clearTimeout(room.flagTimer);
		if (!room.begun || room.drop.size) return;
		const side = room.position.turn;
		const left = turnLeft(room.banks[side], room.turnStarted, Date.now());
		room.flagTimer = setTimeout(() => {
			if (!rooms.has(room.id) || !room.begun || room.drop.size) return;
			flagRoom(room);
		}, left);
	};

	const beginRoom = (room: Room) => {
		if (room.begun) return;
		room.begun = true;
		if (room.readyTimer) clearTimeout(room.readyTimer);
		room.readyTimer = undefined;
		room.banks = { white: blitzStartMs, black: blitzStartMs };
		room.turnStarted = Date.now();
		armFlag(room);
		const clocks = clockFields(room);
		const snap = snapshotOf(room.id, room.position, room.ply, true, clocks);
		for (const s of room.socks.values())
			send(s, { type: 'begin', ...snap, ...clocks });
	};

	const attach = (room: Room, id: string, sock: TextSock) => {
		room.socks.set(id, sock);

		const pending = room.drop.get(id);
		if (pending) clearTimeout(pending);
		room.drop.delete(id);
		const color: Side = id === room.white ? 'white' : 'black';
		if (room.friend && !room.black) return;
		const clocks = clockFields(room);
		const snap = snapshotOf(
			room.id,
			room.position,
			room.ply,
			room.begun,
			clocks,
		);
		send(sock, { type: 'start', color, ...snap, ...clocks });
		pushState(room, sock, color);
		if (room.begun && room.drop.size === 0) {
			if (pending) room.turnStarted = Date.now();
			room.dropUntil = 0;
			armFlag(room);
			for (const [pid, s] of room.socks) {
				if (pid === id) continue;
				pushState(room, s, pid === room.white ? 'white' : 'black');
			}
		}
	};

	const dropPlayer = (room: Room, id: string) => {
		if (room.begun && room.drop.size === 0) {
			const side = room.position.turn;
			room.banks[side] = turnLeft(
				room.banks[side],
				room.turnStarted,
				Date.now(),
			);
		}
		room.socks.delete(id);

		const pending = room.drop.get(id);
		if (pending) clearTimeout(pending);
		if (room.flagTimer) {
			clearTimeout(room.flagTimer);
			room.flagTimer = undefined;
		}
		room.drop.set(
			id,
			setTimeout(() => {
				room.drop.delete(id);
				if (!rooms.has(room.id) || room.socks.has(id)) return;
				void endRoom(room, otherOf(room, id), 'timeout', id);
			}, DROP_MS),
		);
		room.dropUntil = Date.now() + DROP_MS;
		for (const [pid, s] of room.socks) {
			pushState(room, s, pid === room.white ? 'white' : 'black');
		}
	};

	const armReady = (room: Room) => {
		if (room.readyTimer) clearTimeout(room.readyTimer);
		room.readyTimer = setTimeout(() => {
			if (room.begun || !rooms.has(room.id)) return;
			const missing = [room.white, room.black].filter(
				(pid) => pid && !room.ready.has(pid),
			);
			if (missing.length === 1)
				void endRoom(room, otherOf(room, missing[0]), 'timeout', missing[0]);
			else void endRoom(room, 'draw', 'timeout');
		}, READY_MS);
	};

	const openOnlineRoom = async (
		white: string,
		black: string,
		friend: boolean,
	) => {
		const id = await repository.open(white, black);
		const room: Room = {
			id,
			white,
			black,
			friend,
			position: createInitialPosition(),
			ply: 0,
			keys: [],
			begun: false,
			ready: new Set(),
			banks: { white: blitzStartMs, black: blitzStartMs },
			turnStarted: 0,
			socks: new Map(),
			drop: new Map(),
		};
		rooms.set(id, room);
		playerRoom.set(white, id);
		if (black) {
			playerRoom.set(black, id);
			armReady(room);
		}

		return room;
	};

	const pair = async () => {
		while (queue.length >= 2) {
			const a = queue.shift()!;
			const b = queue.shift()!;
			if (a.id === b.id) {
				queue.unshift(b);
				continue;
			}
			if (playerRoom.has(a.id) || playerRoom.has(b.id)) continue;
			const room = await openOnlineRoom(a.id, b.id, false);
			attach(room, a.id, a.sock);
			attach(room, b.id, b.sock);
		}
	};

	const handleWs = async (
		sock: TextSock,
		raw: string,
		ctx: { player?: string },
	) => {
		let msg: {
			type?: string;
			token?: string;
			from?: string;
			path?: string[];
			matchId?: string;
		} = {};
		try {
			msg = JSON.parse(raw);
		} catch {
			send(sock, { type: 'error', error: 'bad_json' });
			return;
		}
		if (msg.type === 'auth') {
			const id = await playerFromAuth(
				msg.token ? `Bearer ${msg.token}` : undefined,
			);
			if (!id) {
				send(sock, { type: 'error', error: 'unauthorized' });
				sock.close();
				return;
			}
			ctx.player = id;
			send(sock, { type: 'ok', playerId: id });
			const rid = playerRoom.get(id);
			if (rid) {
				const room = rooms.get(rid);
				if (room) attach(room, id, sock);
			}
			return;
		}
		if (!ctx.player) {
			send(sock, { type: 'error', error: 'unauthorized' });
			return;
		}
		const player = ctx.player;
		if (msg.type === 'queue') {
			if (limited(`q:${player}`, 8)) {
				send(sock, { type: 'error', error: 'rate' });
				return;
			}
			if (playerRoom.has(player) || queue.some((q) => q.id === player)) {
				send(sock, { type: 'error', error: 'busy' });
				return;
			}
			queue.push({ id: player, sock });

			send(sock, { type: 'queued' });
			await pair();
			return;
		}
		if (msg.type === 'host') {
			if (playerRoom.has(player) || queue.some((q) => q.id === player)) {
				send(sock, { type: 'error', error: 'busy' });
				return;
			}
			const room = await openOnlineRoom(player, '', true);
			attach(room, player, sock);
			const code = mintFriendCode(new Set(friendCodes.keys()));
			friendCodes.set(code, room.id);
			send(sock, { type: 'hosted', matchId: room.id, code });
			return;
		}
		if (msg.type === 'join') {
			const token = String(msg.matchId ?? '');
			const rid = resolveFriendJoin(token, friendCodes) ?? '';
			const room = rooms.get(rid);
			if (!room || !room.friend || room.black || room.begun) {
				send(sock, { type: 'error', error: 'no_match' });
				return;
			}
			if (room.white === player) {
				send(sock, { type: 'error', error: 'busy' });
				return;
			}
			room.black = player;
			playerRoom.set(player, room.id);
			for (const [code, id] of friendCodes)
				if (id === room.id) friendCodes.delete(code);
			await repository.assignBlack(room.id, player);
			attach(room, player, sock);
			attach(room, room.white, room.socks.get(room.white)!);
			armReady(room);

			return;
		}
		if (msg.type === 'leave') {
			const i = queue.findIndex((q) => q.id === player);
			if (i >= 0) {
				queue.splice(i, 1);
			}
			const rid = playerRoom.get(player);
			const room = rid ? rooms.get(rid) : undefined;
			if (room?.friend && !room.begun) {
				void endRoom(room, 'draw', 'timeout');
			}
			return;
		}
		if (msg.type === 'ready') {
			const rid = playerRoom.get(player);
			const room = rid ? rooms.get(rid) : undefined;
			if (!room) return;
			room.ready.add(player);
			if (bothReady(room.ready, room.white, room.black)) beginRoom(room);
			return;
		}
		if (msg.type === 'state') {
			const rid = playerRoom.get(player);
			const room = rid ? rooms.get(rid) : undefined;
			if (!room) return;
			const color: Side = player === room.white ? 'white' : 'black';
			pushState(room, sock, color);
			return;
		}
		if (msg.type === 'move') {
			const rid = playerRoom.get(player);
			const room = rid ? rooms.get(rid) : undefined;
			if (!room) {
				send(sock, { type: 'error', error: 'no_match' });
				return;
			}
			if (!room.begun || room.drop.size) {
				send(sock, { type: 'error', error: 'illegal' });
				return;
			}
			const side: Side = player === room.white ? 'white' : 'black';
			if (side !== room.position.turn) {
				send(sock, { type: 'error', error: 'illegal' });
				return;
			}
			if (turnLeft(room.banks[side], room.turnStarted, Date.now()) <= 0) {
				flagRoom(room);
				return;
			}
			const ply: RecordedPly = {
				side,
				from: msg.from ?? '',
				path: msg.path ?? [],
			};
			const next = applyPly(room.position, ply);
			if (!next) {
				send(sock, { type: 'error', error: 'illegal' });
				pushState(room, sock, side);
				return;
			}
			room.banks[side] = afterMoveBank(
				turnLeft(room.banks[side], room.turnStarted, Date.now()),
			);
			room.position = next;
			room.ply += 1;
			room.keys.push(hashPosition(next));
			room.turnStarted = Date.now();
			armFlag(room);
			await repository.appendPly(room.id, room.ply, ply);
			const payload = {
				type: 'move',
				from: ply.from,
				path: ply.path,
				side,
				ply: room.ply,
				turn: next.turn,
				hash: hashPosition(next),
			};
			for (const s of room.socks.values()) send(s, payload);
			const outcome = resultSide(next, room.keys);
			if (outcome === 'draw') await endRoom(room, 'draw', 'rules');
			else if (outcome) await endRoom(room, outcome, 'rules');
			return;
		}
		if (msg.type === 'resign') {
			const rid = playerRoom.get(player);
			const room = rid ? rooms.get(rid) : undefined;
			if (!room) return;
			await endRoom(room, otherOf(room, player), 'resign', player);
			return;
		}
		if (msg.type === 'flag') {
			const rid = playerRoom.get(player);
			const room = rid ? rooms.get(rid) : undefined;
			if (!room || !room.begun || room.drop.size) return;
			const side = room.position.turn;
			if (!flagDue(room.banks[side], room.turnStarted, Date.now())) return;
			flagRoom(room);
		}
	};
	return {
		handleWs,
		status: () => ({ queue: queue.length, rooms: rooms.size }),
		disconnect(player: string, sock: TextSock) {
			const index = queue.findIndex(
				(entry) => entry.id === player && entry.sock === sock,
			);
			if (index >= 0) queue.splice(index, 1);
			const roomId = playerRoom.get(player);
			const room = roomId ? rooms.get(roomId) : undefined;
			if (room && room.socks.get(player) === sock) dropPlayer(room, player);
		},
		dispose() {
			for (const room of rooms.values()) {
				if (room.readyTimer) clearTimeout(room.readyTimer);
				if (room.flagTimer) clearTimeout(room.flagTimer);
				for (const timer of room.drop.values()) clearTimeout(timer);
				for (const sock of room.socks.values()) sock.close();
			}
			for (const entry of queue) entry.sock.close();
			rooms.clear();
			queue.length = 0;
			friendCodes.clear();
			playerRoom.clear();
		},
	};
}
export type MatchService = ReturnType<typeof createMatchService>;
