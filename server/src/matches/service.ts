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
	createInitialPosition,
	type IPosition,
	resultSide,
	type Side,
} from '../../../shared/rules/index.ts';
import type { AuthService } from '../auth/service.ts';
import type { RateLimiter } from '../transport/rateLimit.ts';
import type { TextSock } from '../wsRaw.ts';
import { flagDue, flagWinner, turnLeft } from './flagClock.ts';
import {
	defaultTimeControl,
	isSelectableTimeControl,
	timeControls,
	type SelectableTimeControl,
} from '../../../shared/rules/timeControl.ts';
import { mintFriendCode, resolveFriendJoin } from './friendCode.ts';
import type { MatchRepository } from './repository.ts';
import type { MatchRuntime } from './runtime.ts';
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
		timeControl: SelectableTimeControl;
		friendCode?: string;
		drawOffer: Side | null;
		lastDrawOffer: Side | null;
		dropDeadlines: Record<string, number>;
		ending?: boolean;
		resultFrozen?: boolean;
	};

	const queue: { id: string; sock: TextSock }[] = [];

	const rooms = new Map<string, Room>();

	const friendCodes = new Map<string, string>();

	const playerRoom = new Map<string, string>();
	const operations = new Map<string, Promise<unknown>>();
	let disposed = false;
	const serialize = <Value>(key: string, operation: () => Promise<Value>): Promise<Value> => {
		const previous = operations.get(key) ?? Promise.resolve();
		const next = previous.catch(() => {}).then(operation);
		operations.set(key, next);
		void next.finally(() => {
			if (operations.get(key) === next) operations.delete(key);
		}).catch(() => {});
		return next;
	};
	const runtimeOf = (room: Room): MatchRuntime => ({
		version: 1, white: room.white, black: room.black,
		position: room.position, ply: room.ply, keys: room.keys,
		begun: room.begun, banks: room.banks, turnStarted: room.turnStarted,
		friend: room.friend, friendCode: room.friendCode, timeControl: room.timeControl,
		drawOffer: room.drawOffer, lastDrawOffer: room.lastDrawOffer,
		dropDeadlines: room.dropDeadlines,
	});

	const send = (sock: TextSock | undefined, msg: unknown) => {
		if (sock) sock.send(JSON.stringify(msg));
	};

	const endRoom = async (
		room: Room,
		win: Side | 'draw',
		reason: string,
		loserId?: string,
	) => {
		if (!rooms.has(room.id) || room.ending || disposed) return;
		room.ending = true;
		if (room.flagTimer) clearTimeout(room.flagTimer);
		if (!room.resultFrozen && room.begun) {
			const side = room.position.turn;
			const now = Date.now();
			room.banks[side] = turnLeft(room.banks[side], room.turnStarted, now);
			room.turnStarted = now;
			room.resultFrozen = true;
		}
		try {
			await repository.finish(room.id, win, reason, runtimeOf(room));
		} catch (error) {
			process.stderr.write(`endRoom db ${error}\n`);
			room.flagTimer = setTimeout(() => {
				void serialize(room.id, async () => {
					room.ending = false;
					if (!disposed) await endRoom(room, win, reason, loserId);
				});
			}, 1000);
			return;
		}
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
	};

	const otherOf = (room: Room, id: string): Side =>
		id === room.white ? 'black' : 'white';

	const clockFields = (room: Room) => ({
		banks: { white: room.banks.white, black: room.banks.black },
		turnStarted: room.turnStarted,
		paused: !room.begun || Boolean(room.ending),
		serverNow: Date.now(),
		timeControl: room.timeControl,
		dropUntil: room.drop.size > 0 ? (room.dropUntil ?? 0) : 0,
		drawOffer: room.drawOffer,
		lastDrawOffer: room.lastDrawOffer,
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
		const boardWinner = resultSide(room.position, room.keys);
		if (boardWinner) return endRoom(room, boardWinner, 'rules');
		const loser = room.position.turn;
		const loserId = loser === 'white' ? room.white : room.black;
		return endRoom(room, flagWinner(loser), 'flag', loserId);
	};

	const armFlag = (room: Room) => {
		if (room.flagTimer) clearTimeout(room.flagTimer);
		if (!room.begun || room.ending || disposed) return;
		const side = room.position.turn;
		const left = turnLeft(room.banks[side], room.turnStarted, Date.now());
		room.flagTimer = setTimeout(() => {
			void serialize(room.id, async () => {
				if (!rooms.has(room.id) || !room.begun || room.ending) return;
				if (turnLeft(room.banks[room.position.turn], room.turnStarted, Date.now()) > 0) armFlag(room);
				else await flagRoom(room);
			});
		}, left);
	};

	const beginRoom = async (room: Room) => {
		if (room.begun) return;
		const initialMs = timeControls[room.timeControl].initialMs;
		const proposed = { ...runtimeOf(room), begun: true, banks: { white: initialMs, black: initialMs }, turnStarted: Date.now() };
		await repository.save(room.id, proposed);
		Object.assign(room, proposed);
		if (room.readyTimer) clearTimeout(room.readyTimer);
		room.readyTimer = undefined;
		armFlag(room);
		const clocks = clockFields(room);
		const snap = snapshotOf(room.id, room.position, room.ply, true, clocks);
		for (const s of room.socks.values())
			send(s, { type: 'begin', ...snap, ...clocks });
	};

	const attach = async (room: Room, id: string, sock: TextSock) => {
		room.socks.set(id, sock);

		const pending = room.drop.get(id);
		if (pending) clearTimeout(pending);
		room.drop.delete(id);
		delete room.dropDeadlines[id];
		room.dropUntil = Math.min(...Object.values(room.dropDeadlines), Infinity);
		await repository.save(room.id, runtimeOf(room));
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
		if (room.begun) {
			armFlag(room);
			for (const [pid, s] of room.socks) {
				if (pid === id) continue;
				pushState(room, s, pid === room.white ? 'white' : 'black');
			}
		}
	};

	const dropPlayer = async (room: Room, id: string) => {
		room.socks.delete(id);

		const pending = room.drop.get(id);
		if (pending) clearTimeout(pending);
		const deadline = room.dropDeadlines[id] ?? Date.now() + DROP_MS;
		room.dropDeadlines[id] = deadline;
		room.drop.set(
			id,
			setTimeout(() => {
				void serialize(room.id, async () => {
					if (!rooms.has(room.id) || room.socks.has(id)) return;
					if (room.begun && turnLeft(room.banks[room.position.turn], room.turnStarted, Date.now()) <= 0)
						await flagRoom(room);
					else {
						const other = id === room.white ? room.black : room.white;
						const bothAbsent = !room.socks.has(other) && room.dropDeadlines[other] === deadline;
						await endRoom(room, bothAbsent ? 'draw' : otherOf(room, id), 'timeout', bothAbsent ? undefined : id);
					}
				});
			}, Math.max(0, deadline - Date.now())),
		);
		room.dropUntil = Math.min(...Object.values(room.dropDeadlines));
		await repository.save(room.id, runtimeOf(room));
		for (const [pid, s] of room.socks) {
			pushState(room, s, pid === room.white ? 'white' : 'black');
		}
	};

	const armReady = (room: Room) => {
		if (room.readyTimer) clearTimeout(room.readyTimer);
		room.readyTimer = setTimeout(() => { void serialize(room.id, async () => {
			if (room.begun || !rooms.has(room.id)) return;
			const missing = [room.white, room.black].filter(
				(pid) => pid && !room.ready.has(pid),
			);
			if (missing.length === 1)
				await endRoom(room, otherOf(room, missing[0]), 'timeout', missing[0]);
			else await endRoom(room, 'draw', 'timeout');
		}); }, READY_MS);
	};

	const openOnlineRoom = async (
		white: string,
		black: string,
		friend: boolean,
		timeControl: SelectableTimeControl = defaultTimeControl,
	) => {
		const id = await repository.open(white, black, timeControl);
		const initialMs = timeControls[timeControl].initialMs;
		const room: Room = {
			id,
			white,
			black,
			friend,
			timeControl,
			position: createInitialPosition(),
			ply: 0,
			keys: [hashPosition(createInitialPosition())],
			begun: false,
			ready: new Set(),
			banks: { white: initialMs, black: initialMs },
			turnStarted: 0,
			socks: new Map(),
			drop: new Map(),
			dropDeadlines: {},
			drawOffer: null,
			lastDrawOffer: null,
		};
		await repository.save(id, runtimeOf(room));
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
			await attach(room, a.id, a.sock);
			await attach(room, b.id, b.sock);
		}
	};

	const handleWs = async (
		sock: TextSock,
		raw: string,
		ctx: { player?: string },
		receivedAt: number,
	) => {
		let msg: {
			type?: string;
			token?: string;
			from?: string;
			path?: string[];
			matchId?: string;
			timeControl?: unknown;
			ply?: number;
		} = {};
		try {
			msg = JSON.parse(raw);
		} catch {
			send(sock, { type: 'error', error: 'bad_json' });
			return;
		}
		if (msg.type === 'auth') {
			if (ctx.player) {
				send(sock, { type: 'error', error: 'already_authenticated' });
				return;
			}
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
				if (room) await serialize(room.id, () => attach(room, id, sock));
			} else if (typeof msg.matchId === 'string') {
				const completed = await repository.completed(msg.matchId, id);
				if (completed) {
					const saved = completed.runtime;
					send(sock, {
						type: 'resume_end', color: saved.white === id ? 'white' : 'black',
						winner: completed.winner, reason: completed.reason,
						...snapshotOf(msg.matchId, saved.position, saved.ply, true, {
							banks: saved.banks, turnStarted: saved.turnStarted, paused: true,
							serverNow: Date.now(), timeControl: saved.timeControl,
						}),
						banks: saved.banks, turnStarted: saved.turnStarted, paused: true,
						serverNow: Date.now(), timeControl: saved.timeControl,
					});
				}
			}
			return;
		}
		if (!ctx.player) {
			send(sock, { type: 'error', error: 'unauthorized' });
			return;
		}
		const player = ctx.player;
		const activeId = playerRoom.get(player);
		const activeRoom = activeId ? rooms.get(activeId) : undefined;
		if (activeRoom && activeRoom.socks.get(player) !== sock) return;
		if (activeRoom?.ending) return;
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
			if (
				msg.timeControl !== undefined &&
				!isSelectableTimeControl(msg.timeControl)
			) {
				send(sock, { type: 'error', error: 'bad_time_control' });
				return;
			}
			if (playerRoom.has(player) || queue.some((q) => q.id === player)) {
				send(sock, { type: 'error', error: 'busy' });
				return;
			}
			const room = await openOnlineRoom(
				player,
				'',
				true,
				msg.timeControl ?? defaultTimeControl,
			);
			await attach(room, player, sock);
			const code = mintFriendCode(new Set(friendCodes.keys()));
			room.friendCode = code;
			await repository.save(room.id, runtimeOf(room));
			friendCodes.set(code, room.id);
			send(sock, {
				type: 'hosted',
				matchId: room.id,
				code,
				timeControl: room.timeControl,
			});
			return;
		}
		if (msg.type === 'join') {
			if (playerRoom.has(player) || queue.some((entry) => entry.id === player)) {
				send(sock, { type: 'error', error: 'busy' });
				return;
			}
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
			await repository.save(room.id, { ...runtimeOf(room), black: player });
			room.black = player;
			playerRoom.set(player, room.id);
			for (const [code, id] of friendCodes)
				if (id === room.id) friendCodes.delete(code);
			await attach(room, player, sock);
			const host = room.socks.get(room.white);
			if (host) await attach(room, room.white, host);
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
			if (bothReady(room.ready, room.white, room.black)) await beginRoom(room);
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
			if (!room.begun) {
				send(sock, { type: 'error', error: 'illegal' });
				return;
			}
			if (msg.ply !== room.ply + 1 || typeof msg.from !== 'string' ||
				!Array.isArray(msg.path) || msg.path.length < 1 || msg.path.length > 32 ||
				msg.path.some((square) => typeof square !== 'string')) {
				send(sock, { type: 'error', error: 'illegal' });
				pushState(room, sock);
				return;
			}
			const side: Side = player === room.white ? 'white' : 'black';
			if (side !== room.position.turn) {
				send(sock, { type: 'error', error: 'illegal' });
				return;
			}
			if (turnLeft(room.banks[side], room.turnStarted, receivedAt) <= 0) {
				await flagRoom(room);
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
			const banks = { ...room.banks };
			banks[side] = afterMoveBank(
				turnLeft(room.banks[side], room.turnStarted, receivedAt),
				timeControls[room.timeControl].incrementMs,
			);
			const proposed: MatchRuntime = {
				...runtimeOf(room), banks, position: next, ply: room.ply + 1,
				keys: [...room.keys, hashPosition(next)], turnStarted: receivedAt,
				drawOffer: null,
			};
			await repository.save(room.id, proposed, ply);
			Object.assign(room, proposed);
			const payload = {
				type: 'move',
				from: ply.from,
				path: ply.path,
				side,
				ply: room.ply,
				turn: next.turn,
				hash: hashPosition(next),
				...clockFields(room),
			};
			for (const s of room.socks.values()) send(s, payload);
			const outcome = resultSide(next, room.keys);
			if (outcome === 'draw') await endRoom(room, 'draw', 'rules');
			else if (outcome) await endRoom(room, outcome, 'rules');
			else armFlag(room);
			return;
		}
		if (msg.type === 'draw_offer' || msg.type === 'draw_accept' || msg.type === 'draw_decline') {
			const room = activeRoom;
			if (!room || !room.begun) return;
			if (msg.ply !== room.ply) {
				send(sock, { type: 'error', error: 'draw_unavailable' });
				return;
			}
			if (turnLeft(room.banks[room.position.turn], room.turnStarted, receivedAt) <= 0) {
				await flagRoom(room);
				return;
			}
			const side: Side = player === room.white ? 'white' : 'black';
			if (msg.type === 'draw_offer') {
				if (room.ply < 1 || room.position.turn === side || room.drawOffer || room.lastDrawOffer === side) {
					send(sock, { type: 'error', error: 'draw_unavailable' });
					return;
				}
				await repository.save(room.id, { ...runtimeOf(room), drawOffer: side, lastDrawOffer: side });
				room.drawOffer = room.lastDrawOffer = side;
			} else {
				if (!room.drawOffer || room.drawOffer === side) return;
				if (msg.type === 'draw_accept') {
					await endRoom(room, 'draw', 'agreement');
					return;
				}
				await repository.save(room.id, { ...runtimeOf(room), drawOffer: null });
				room.drawOffer = null;
			}
			for (const connection of room.socks.values()) send(connection, {
				type: 'draw', drawOffer: room.drawOffer, lastDrawOffer: room.lastDrawOffer,
			});
			return;
		}
		if (msg.type === 'resign') {
			const rid = playerRoom.get(player);
			const room = rid ? rooms.get(rid) : undefined;
			if (!room) return;
			if (room.begun && turnLeft(room.banks[room.position.turn], room.turnStarted, receivedAt) <= 0) {
				await flagRoom(room);
				return;
			}
			await endRoom(room, otherOf(room, player), 'resign', player);
			return;
		}
		if (msg.type === 'flag') {
			const rid = playerRoom.get(player);
			const room = rid ? rooms.get(rid) : undefined;
			if (!room || !room.begun) return;
			const side = room.position.turn;
			if (!flagDue(room.banks[side], room.turnStarted, Date.now())) return;
			await flagRoom(room);
		}
	};
	return {
		async restore() {
			for (const saved of await repository.active()) {
				if (saved.runtime.version !== 1) throw new Error('Unsupported match runtime version');
				const room: Room = {
					...saved.runtime, id: saved.id, ready: new Set(), socks: new Map(), drop: new Map(),
				};
				rooms.set(room.id, room);
				playerRoom.set(room.white, room.id);
				if (room.black) playerRoom.set(room.black, room.id);
				if (room.friendCode && !room.black) friendCodes.set(room.friendCode, room.id);
				const outcome = resultSide(room.position, room.keys);
				if (outcome) {
					await endRoom(room, outcome, 'rules');
					continue;
				}
				if (room.begun && turnLeft(room.banks[room.position.turn], room.turnStarted, Date.now()) <= 0) {
					await flagRoom(room);
					continue;
				}
				await dropPlayer(room, room.white);
				if (room.black) await dropPlayer(room, room.black);
				if (room.begun) armFlag(room);
				else if (room.black) armReady(room);
			}
		},
		handleWs(sock: TextSock, raw: string, ctx: { player?: string }) {
			const receivedAt = Date.now();
			const key = ctx.player ? playerRoom.get(ctx.player) ?? 'lobby' : 'lobby';
			return serialize(key, async () => {
				if (disposed) return;
				try {
					await handleWs(sock, raw, ctx, receivedAt);
				} catch (error) {
					send(sock, { type: 'error', error: 'storage_unavailable' });
					throw error;
				}
			});
		},
		status: () => ({ queue: queue.length, rooms: rooms.size }),
		disconnect(player: string, sock: TextSock) {
			if (disposed) return;
			const index = queue.findIndex(
				(entry) => entry.id === player && entry.sock === sock,
			);
			if (index >= 0) queue.splice(index, 1);
			const roomId = playerRoom.get(player);
			const room = roomId ? rooms.get(roomId) : undefined;
			if (room) void serialize(room.id, async () => {
				if (!disposed && rooms.has(room.id) && room.socks.get(player) === sock)
					await dropPlayer(room, player);
			}).catch((error) => process.stderr.write(`disconnect db ${error}\n`));
		},
		dispose() {
			disposed = true;
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
