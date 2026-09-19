import {writeFileSync} from 'node:fs';
import {createHash, randomBytes, randomInt} from 'node:crypto';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {applyPly, replayPlies, type RecordedPly} from '../../src/online/replay.ts';
import {bothReady, hashPosition, READY_MS, snapshotOf} from '../../src/online/matchState.ts';
import {createInitialPosition, winner, afterMoveBank, blitzStartMs, resultSide, type IPosition, type Side} from '../../src/rules/index.ts';
import {flagDue, flagWinner, turnLeft} from './flagClock.ts';
import {colorStatsSql, COLOR_STATS_CACHE_MS} from '../../src/online/colorStats.ts';
import {countHeartbeats, dropHeartbeat, touchHeartbeat} from '../../src/online/presence.ts';
import {mintFriendCode, resolveFriendJoin} from '../../src/online/friendCode.ts';
import {acceptWebsocket, type TextSock} from './wsRaw.ts';
import {runMigrations} from './migrate.ts';

const require = createRequire(new URL('../package.json', import.meta.url));
const pg = require('pg') as typeof import('pg');
const url = process.env.DATABASE_URL ?? 'postgres://checkers:checkers@127.0.0.1:5433/checkers';
const port = Number(process.env.PORT ?? 8787);
const pool = new pg.Pool({connectionString: url});
const DROP_MS = 60_000;

type Res = import('node:http').ServerResponse;
const json = (res: Res, code: number, body: unknown) => {
 res.writeHead(code, {
  'content-type': 'application/json; charset=utf-8',
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type, authorization',
 });
 res.end(JSON.stringify(body));
};
const read = (req: import('node:http').IncomingMessage) =>
 new Promise<string>((resolve, reject) => {
  const chunks: Buffer[] = [];
  req.on('data', (c) => chunks.push(c as Buffer));
  req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
  req.on('error', reject);
 });
const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');
const ipOf = (req: import('node:http').IncomingMessage) =>
 (req.headers['x-forwarded-for']?.toString().split(',')[0] ?? req.socket.remoteAddress ?? '').trim();

const hits = new Map<string, {n: number; t: number}>();
const limited = (key: string, max: number, windowMs = 60_000) => {
 const now = Date.now();
 const cur = hits.get(key);
 if (!cur || now - cur.t > windowMs) {
  hits.set(key, {n: 1, t: now});
  return false;
 }
 cur.n += 1;
 return cur.n > max;
};

const playerFromAuth = async (header: string | undefined) => {
 const token = header?.startsWith('Bearer ') ? header.slice(7) : '';
 if (!token) return null;
 const h = hashToken(token);
 const idn = await pool.query(`SELECT player_id FROM auth_identities WHERE kind='device' AND token_hash=$1`, [h]);
 if (idn.rows[0]) return idn.rows[0].player_id as string;
 const old = await pool.query(`SELECT id FROM players WHERE token_hash=$1`, [h]);
 return (old.rows[0]?.id as string | undefined) ?? null;
};

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
 friend: boolean;
};
const queue: {id: string; sock: TextSock}[] = [];
const rooms = new Map<string, Room>();
const friendCodes = new Map<string, string>();
const playerRoom = new Map<string, string>();
let colorStatsCache: {at: number; body: {white: number; black: number; games: number}} | undefined;
let presenceCache: {at: number; live: number} | undefined;
const heartbeats = new Map<string, number>();
const bumpPresence = () => { presenceCache = undefined; };
const siteLive = () => countHeartbeats(heartbeats, Date.now());

const send = (sock: TextSock | undefined, msg: unknown) => {
 if (sock) sock.send(JSON.stringify(msg));
};

const endRoom = async (room: Room, win: Side | 'draw', reason: string, loserId?: string) => {
 if (!rooms.has(room.id)) return;
 rooms.delete(room.id);
 for (const [code, id] of friendCodes) if (id === room.id) friendCodes.delete(code);
 bumpPresence();
 playerRoom.delete(room.white);
 playerRoom.delete(room.black);
 if (room.readyTimer) clearTimeout(room.readyTimer);
 if (room.flagTimer) clearTimeout(room.flagTimer);
 for (const t of room.drop.values()) clearTimeout(t);
 for (const [pid, sock] of room.socks) {
  const youWin = loserId ? pid !== loserId : win !== 'draw' && ((win === 'white' && pid === room.white) || (win === 'black' && pid === room.black));
  send(sock, {type: 'end', winner: win, youWin, reason});
 }
 try {
  await pool.query(`UPDATE matches SET winner=$2, ended_at=now() WHERE id=$1`, [room.id, win]);
 } catch (err) {
  process.stderr.write(`endRoom db ${err}\n`);
 }
};

const otherOf = (room: Room, id: string) => (id === room.white ? room.black : room.white);

const pushState = (room: Room, sock: TextSock | undefined, color?: Side) => {
 const snap = snapshotOf(room.id, room.position, room.ply, room.begun);
 send(sock, {type: 'state', color, ...snap});
};

const flagRoom = (room: Room) => {
 const loser = room.position.turn;
 const loserId = loser === 'white' ? room.white : room.black;
 void endRoom(room, flagWinner(loser), 'flag', loserId);
};

const armFlag = (room: Room) => {
 if (room.flagTimer) clearTimeout(room.flagTimer);
 const side = room.position.turn;
 const left = turnLeft(room.banks[side], room.turnStarted, Date.now());
 room.flagTimer = setTimeout(() => {
  if (!rooms.has(room.id) || !room.begun) return;
  flagRoom(room);
 }, left);
};

const beginRoom = (room: Room) => {
 if (room.begun) return;
 room.begun = true;
 if (room.readyTimer) clearTimeout(room.readyTimer);
 room.readyTimer = undefined;
 room.banks = {white: blitzStartMs, black: blitzStartMs};
 room.turnStarted = Date.now();
 armFlag(room);
 const snap = snapshotOf(room.id, room.position, room.ply, true);
 for (const s of room.socks.values()) send(s, {type: 'begin', ...snap});
};

const attach = (room: Room, id: string, sock: TextSock) => {
 room.socks.set(id, sock);
 bumpPresence();
 const pending = room.drop.get(id);
 if (pending) clearTimeout(pending);
 room.drop.delete(id);
 const color: Side = id === room.white ? 'white' : 'black';
 if (room.friend && !room.black) return;
 const snap = snapshotOf(room.id, room.position, room.ply, room.begun);
 send(sock, {type: 'start', matchId: room.id, color, turn: snap.turn, ply: snap.ply, hash: snap.hash, begun: snap.begun, pieces: snap.pieces});
 pushState(room, sock, color);
 if (room.begun && room.drop.size === 0) {
  room.turnStarted = Date.now();
  armFlag(room);
 }
};

const dropPlayer = (room: Room, id: string) => {
 room.socks.delete(id);
 bumpPresence();
 const pending = room.drop.get(id);
 if (pending) clearTimeout(pending);
 if (room.flagTimer) { clearTimeout(room.flagTimer); room.flagTimer = undefined; }
 room.drop.set(id, setTimeout(() => {
  room.drop.delete(id);
  if (!rooms.has(room.id) || room.socks.has(id)) return;
  void endRoom(room, otherOf(room, id) as Side, 'timeout', id);
 }, DROP_MS));
};

const armReady = (room: Room) => {
 if (room.readyTimer) clearTimeout(room.readyTimer);
 room.readyTimer = setTimeout(() => {
  if (room.begun || !rooms.has(room.id)) return;
  const missing = [room.white, room.black].filter((pid) => pid && !room.ready.has(pid));
  if (missing.length === 1) void endRoom(room, otherOf(room, missing[0]) as Side, 'timeout', missing[0]);
  else void endRoom(room, 'draw', 'timeout');
 }, READY_MS);
};

const openOnlineRoom = async (white: string, black: string, friend: boolean) => {
 const inserted = await pool.query(
  `INSERT INTO matches (mode, white_id, black_id) VALUES ('online', $1, $2) RETURNING id`,
  [white, black || null],
 );
 const id = inserted.rows[0].id as string;
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
  banks: {white: blitzStartMs, black: blitzStartMs},
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
 bumpPresence();
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

const handleWs = async (sock: TextSock, raw: string, ctx: {player?: string}) => {
 let msg: {type?: string; token?: string; from?: string; path?: string[]; matchId?: string} = {};
 try { msg = JSON.parse(raw); } catch { send(sock, {type: 'error', error: 'bad_json'}); return; }
 if (msg.type === 'auth') {
  const id = await playerFromAuth(msg.token ? `Bearer ${msg.token}` : undefined);
  if (!id) { send(sock, {type: 'error', error: 'unauthorized'}); sock.close(); return; }
  ctx.player = id;
  send(sock, {type: 'ok', playerId: id});
  const rid = playerRoom.get(id);
  if (rid) {
   const room = rooms.get(rid);
   if (room) attach(room, id, sock);
  }
  return;
 }
 if (!ctx.player) { send(sock, {type: 'error', error: 'unauthorized'}); return; }
 const player = ctx.player;
 if (msg.type === 'queue') {
  if (limited(`q:${player}`, 8)) { send(sock, {type: 'error', error: 'rate'}); return; }
  if (playerRoom.has(player) || queue.some((q) => q.id === player)) {
   send(sock, {type: 'error', error: 'busy'});
   return;
  }
  queue.push({id: player, sock});
  bumpPresence();
  send(sock, {type: 'queued'});
  await pair();
  return;
 }
 if (msg.type === 'host') {
  if (playerRoom.has(player) || queue.some((q) => q.id === player)) {
   send(sock, {type: 'error', error: 'busy'});
   return;
  }
  const room = await openOnlineRoom(player, '', true);
  attach(room, player, sock);
  const code = mintFriendCode(new Set(friendCodes.keys()));
  friendCodes.set(code, room.id);
  send(sock, {type: 'hosted', matchId: room.id, code});
  return;
 }
 if (msg.type === 'join') {
  const token = String(msg.matchId ?? '');
  const rid = resolveFriendJoin(token, friendCodes) ?? '';
  const room = rooms.get(rid);
  if (!room || !room.friend || room.black || room.begun) {
   send(sock, {type: 'error', error: 'no_match'});
   return;
  }
  if (room.white === player) {
   send(sock, {type: 'error', error: 'busy'});
   return;
  }
  room.black = player;
  playerRoom.set(player, room.id);
  for (const [code, id] of friendCodes) if (id === room.id) friendCodes.delete(code);
  await pool.query(`UPDATE matches SET black_id=$2 WHERE id=$1`, [room.id, player]);
  attach(room, player, sock);
  attach(room, room.white, room.socks.get(room.white)!);
  armReady(room);
  bumpPresence();
  return;
 }
 if (msg.type === 'leave') {
  const i = queue.findIndex((q) => q.id === player);
  if (i >= 0) { queue.splice(i, 1); bumpPresence(); }
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
  if (!room) { send(sock, {type: 'error', error: 'no_match'}); return; }
  if (!room.begun) { send(sock, {type: 'error', error: 'illegal'}); return; }
  const side: Side = player === room.white ? 'white' : 'black';
  if (side !== room.position.turn) { send(sock, {type: 'error', error: 'illegal'}); return; }
  if (turnLeft(room.banks[side], room.turnStarted, Date.now()) <= 0) { flagRoom(room); return; }
  const ply: RecordedPly = {side, from: msg.from ?? '', path: msg.path ?? []};
  const next = applyPly(room.position, ply);
  if (!next) { send(sock, {type: 'error', error: 'illegal'}); pushState(room, sock, side); return; }
  room.banks[side] = afterMoveBank(turnLeft(room.banks[side], room.turnStarted, Date.now()));
  room.position = next;
  room.ply += 1;
  room.keys.push(hashPosition(next));
  room.turnStarted = Date.now();
  armFlag(room);
  await pool.query(
   `INSERT INTO match_plies (match_id, ply, side, from_sq, path) VALUES ($1,$2,$3,$4,$5)`,
   [room.id, room.ply, side, ply.from, JSON.stringify(ply.path)],
  );
  const payload = {type: 'move', from: ply.from, path: ply.path, side, ply: room.ply, turn: next.turn, hash: hashPosition(next)};
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
  await endRoom(room, otherOf(room, player) as Side, 'resign', player);
  return;
 }
 if (msg.type === 'flag') {
  const rid = playerRoom.get(player);
  const room = rid ? rooms.get(rid) : undefined;
  if (!room || !room.begun) return;
  const side = room.position.turn;
  if (!flagDue(room.banks[side], room.turnStarted, Date.now())) return;
  flagRoom(room);
 }
};

await runMigrations((text, params) => pool.query(text, params));

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
   json(res, 200, {ok: true, db: true, queue: queue.length, rooms: rooms.size, ws: '/ws'});
   return;
  }
  if (req.method === 'GET' && path === '/stats/colors') {
   const now = Date.now();
   if (colorStatsCache && now - colorStatsCache.at < COLOR_STATS_CACHE_MS) {
    json(res, 200, colorStatsCache.body);
    return;
   }
   const rows = await pool.query(colorStatsSql);
   const body = {
    white: Number(rows.rows[0]?.white ?? 0),
    black: Number(rows.rows[0]?.black ?? 0),
    games: Number(rows.rows[0]?.games ?? 0),
   };
   colorStatsCache = {at: now, body};
   json(res, 200, body);
   return;
  }
  if (req.method === 'GET' && (path === '/stats/presence' || path === '/presence')) {
   const live = siteLive();
   json(res, 200, {live});
   return;
  }
  if (req.method === 'POST' && (path === '/stats/presence' || path === '/presence')) {
   const playerId = await playerFromAuth(req.headers.authorization);
   if (!playerId) { json(res, 401, {error: 'auth'}); return; }
   let on = true;
   let tab = '';
   try {
    const body = JSON.parse((await read(req)) || '{}') as {on?: unknown; tab?: unknown};
    if (body.on === false) on = false;
    if (typeof body.tab === 'string' && body.tab.length > 0 && body.tab.length < 80) tab = body.tab;
   } catch {}
   const key = `${playerId}:${tab || 'tab'}`;
   if (on) touchHeartbeat(heartbeats, key, Date.now());
   else dropHeartbeat(heartbeats, key);
   bumpPresence();
   json(res, 200, {live: siteLive()});
   return;
  }
  if (req.method === 'POST' && path === '/players/guest') {
   if (limited(`g:${ipOf(req)}`, 32)) { json(res, 429, {error: 'rate'}); return; }
   const token = randomBytes(24).toString('base64url');
   const h = hashToken(token);
   const created = await pool.query(
    'INSERT INTO players (token_hash) VALUES ($1) RETURNING id, created_at',
    [h],
   );
   const id = created.rows[0].id as string;
   await pool.query(
    `INSERT INTO auth_identities (player_id, kind, token_hash) VALUES ($1,'device',$2)`,
    [id, h],
   );
   json(res, 201, {id, token, createdAt: created.rows[0].created_at});
   return;
  }
  if (req.method === 'GET' && path.startsWith('/players/') && path.endsWith('/stats')) {
   const id = path.slice('/players/'.length, -'/stats'.length);
   const stats = await pool.query(
    `SELECT
      count(*) FILTER (WHERE winner IS NOT NULL)::int AS games,
      count(*) FILTER (WHERE winner = 'white' AND white_id = $1)::int AS white_wins,
      count(*) FILTER (WHERE winner = 'black' AND black_id = $1)::int AS black_wins,
      count(*) FILTER (WHERE mode = 'bot' AND winner IS NOT NULL)::int AS bot_games,
      count(*) FILTER (WHERE mode = 'online' AND winner IS NOT NULL)::int AS online_games
     FROM matches WHERE white_id = $1 OR black_id = $1`,
    [id],
   );
   json(res, 200, {playerId: id, ...stats.rows[0]});
   return;
  }
  if (req.method === 'POST' && path === '/auth/email/start') {
   const playerId = await playerFromAuth(req.headers.authorization);
   if (!playerId) { json(res, 401, {error: 'unauthorized'}); return; }
   if (limited(`e:${playerId}`, 5)) { json(res, 429, {error: 'rate'}); return; }
   const email = String(JSON.parse((await read(req)) || '{}').email ?? '').trim().toLowerCase();
   if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { json(res, 400, {error: 'bad_email'}); return; }
   const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
   await pool.query(
    `INSERT INTO email_codes (email, code_hash, player_id, expires_at)
     VALUES ($1,$2,$3, now() + interval '10 minutes')
     ON CONFLICT (email) DO UPDATE SET code_hash=$2, player_id=$3, expires_at=now()+interval '10 minutes'`,
    [email, hashToken(code), playerId],
   );
   writeFileSync('/tmp/checkers-email-code.txt', `${email} ${code}\n`, 'utf8');
   process.stdout.write(`email-code ${email} ${code}\n`);
   json(res, 200, {ok: true, dev: true});
   return;
  }
  if (req.method === 'POST' && path === '/auth/email/confirm') {
   const playerId = await playerFromAuth(req.headers.authorization);
   if (!playerId) { json(res, 401, {error: 'unauthorized'}); return; }
   const body = JSON.parse((await read(req)) || '{}') as {email?: string; code?: string};
   const email = String(body.email ?? '').trim().toLowerCase();
   const row = await pool.query(
    `SELECT * FROM email_codes WHERE email=$1 AND code_hash=$2 AND expires_at > now()`,
    [email, hashToken(String(body.code ?? ''))],
   );
   if (!row.rows[0] || row.rows[0].player_id !== playerId) { json(res, 400, {error: 'bad_code'}); return; }
   const taken = await pool.query(`SELECT player_id FROM auth_identities WHERE kind='email' AND email=$1`, [email]);
   if (taken.rows[0] && taken.rows[0].player_id !== playerId) {
    json(res, 409, {error: 'link_conflict', playerId: taken.rows[0].player_id});
    return;
   }
   await pool.query(
    `INSERT INTO auth_identities (player_id, kind, email) VALUES ($1,'email',$2)
     ON CONFLICT DO NOTHING`,
    [playerId, email],
   );
   await pool.query(`DELETE FROM email_codes WHERE email=$1`, [email]);
   json(res, 200, {ok: true, playerId});
   return;
  }
  if (req.method === 'GET' && path === '/matches') {
   const playerId = await playerFromAuth(req.headers.authorization);
   if (!playerId) { json(res, 401, {error: 'unauthorized'}); return; }
   const rows = await pool.query(
    `SELECT m.id, m.mode, m.winner, m.started_at, m.white_id, m.black_id,
      (SELECT count(*)::int FROM match_plies p WHERE p.match_id = m.id) AS plies
     FROM matches m
     WHERE m.white_id = $1 OR m.black_id = $1
     ORDER BY m.started_at DESC
     LIMIT 50`,
    [playerId],
   );
   json(res, 200, {
    matches: rows.rows.map((r: {id: string; mode: string; winner: string | null; started_at: Date; white_id: string | null; black_id: string | null; plies: number}) => ({
     id: r.id,
     mode: r.mode,
     winner: r.winner,
     startedAt: r.started_at,
     color: r.white_id === playerId ? 'white' : 'black',
     plies: Number(r.plies ?? 0),
    })),
   });
   return;
  }
  if (req.method === 'GET' && path.startsWith('/matches/')) {
   const playerId = await playerFromAuth(req.headers.authorization);
   if (!playerId) { json(res, 401, {error: 'unauthorized'}); return; }
   const id = path.slice('/matches/'.length);
   if (!/^[0-9a-f-]{36}$/i.test(id)) { json(res, 404, {error: 'not_found'}); return; }
   const row = await pool.query(
    `SELECT id, mode, winner, started_at, white_id, black_id FROM matches WHERE id=$1`,
    [id],
   );
   const m = row.rows[0] as {id: string; mode: string; winner: string | null; started_at: Date; white_id: string | null; black_id: string | null} | undefined;
   if (!m || (m.white_id !== playerId && m.black_id !== playerId)) { json(res, 404, {error: 'not_found'}); return; }
   const plies = await pool.query(
    `SELECT ply, side, from_sq, path FROM match_plies WHERE match_id=$1 ORDER BY ply`,
    [id],
   );
   json(res, 200, {
    id: m.id,
    mode: m.mode,
    winner: m.winner,
    startedAt: m.started_at,
    color: m.white_id === playerId ? 'white' : 'black',
    plies: plies.rows.length,
    pliesList: plies.rows.map((p: {side: string; from_sq: string; path: string}) => {
     let path: string[] = [];
     try { path = JSON.parse(p.path) as string[]; } catch { path = []; }
     return { side: p.side, from: p.from_sq, path };
    }),
   });
   return;
  }
  if (req.method === 'POST' && path === '/matches') {
   const playerId = await playerFromAuth(req.headers.authorization);
   if (!playerId) { json(res, 401, {error: 'unauthorized'}); return; }
   const body = JSON.parse((await read(req)) || '{}') as {
    mode?: string; humanSide?: Side; winner?: Side | 'draw'; plies?: RecordedPly[];
   };
   if (body.mode !== 'bot' || (body.humanSide !== 'white' && body.humanSide !== 'black')) {
    json(res, 400, {error: 'bad_match'}); return;
   }
   if (body.winner !== 'white' && body.winner !== 'black' && body.winner !== 'draw') {
    json(res, 400, {error: 'bad_winner'}); return;
   }
   const plies = Array.isArray(body.plies) ? body.plies : [];
   const replayed = replayPlies(plies);
   if (!replayed.ok) { json(res, 400, {error: 'illegal_ply', ply: replayed.ply}); return; }
   const whiteId = body.humanSide === 'white' ? playerId : null;
   const blackId = body.humanSide === 'black' ? playerId : null;
   const inserted = await pool.query(
    `INSERT INTO matches (mode, white_id, black_id, winner, ended_at) VALUES ('bot', $1, $2, $3, now()) RETURNING id`,
    [whiteId, blackId, body.winner],
   );
   const matchId = inserted.rows[0].id as string;
   let ply = 0;
   for (const step of plies) {
    ply += 1;
    await pool.query(
     `INSERT INTO match_plies (match_id, ply, side, from_sq, path) VALUES ($1,$2,$3,$4,$5)`,
     [matchId, ply, step.side, step.from, JSON.stringify(step.path)],
    );
   }
   json(res, 201, {id: matchId, winner: body.winner, plies: ply});
   return;
  }
  json(res, 404, {error: 'not_found'});
 } catch (error) {
  json(res, 500, {error: error instanceof Error ? error.message : 'server_error'});
 }
});

server.on('upgrade', (req, socket) => {
 if ((req.url ?? '').split('?')[0] !== '/ws') { socket.destroy(); return; }
 const ctx: {player?: string} = {};
 const sock = acceptWebsocket(
  req,
  socket,
  (text) => { void handleWs(sock!, text, ctx).catch((err) => process.stderr.write(`ws ${err}\n`)); },
  () => {
   const id = ctx.player;
   if (!id) return;
   const i = queue.findIndex((q) => q.id === id);
   if (i >= 0) { queue.splice(i, 1); bumpPresence(); }
   const rid = playerRoom.get(id);
   const room = rid ? rooms.get(rid) : undefined;
   if (room) dropPlayer(room, id);
  },
 );
 if (!sock) socket.destroy();
});

server.on('error', (err) => {
 process.stderr.write(`checkers-server ${err}\n`);
});
process.on('uncaughtException', (err) => {
 process.stderr.write(`uncaught ${err}\n`);
});
process.on('unhandledRejection', (err) => {
 process.stderr.write(`unhandled ${err}\n`);
});
server.listen(port, '::', () => {
 process.stdout.write(`checkers-server http://127.0.0.1:${port} http://localhost:${port} ws://localhost:${port}/ws\n`);
});
