import type { IMove, Side } from '@/shared/rules';
import { squareAlg } from '@/shared/protocol/notation';
import { ensureGuest } from './cloud';
import { runtimeApiOrigin, wsUrl as wsFromOrigin } from './apiOrigin';
import { CONNECT_BUDGET_MS } from './networkPolicy';
import type { MatchSnapshot } from '@/shared/protocol/matchState';
import { defaultTimeControl, isTimeControl, type SelectableTimeControl } from '@/shared/rules/timeControl';

export type NetMove = IMove & {ply: number; turn: Side; hash: string; side: Side; clocks?: MatchSnapshot['clocks']; receivedAt?: number};

export type LiveHandlers = {
 onQueued?: () => void;
 onHosted?: (matchId: string, code?: string) => void;
 onStart?: (color: Side, matchId: string, snap: MatchSnapshot) => void;
 onBegin?: (snap: MatchSnapshot) => void;
 onState?: (snap: MatchSnapshot) => void;
 onMove?: (move: NetMove) => void;
 onDraw?: (offer: Side | null, lastOffer?: Side | null) => void;
 onRecovered?: (color: Side, snap: MatchSnapshot, winner: Side | 'draw', reason: string) => void;
 onEnd?: (winner: Side | 'draw', reason: string, youWin?: boolean) => void;
 onError?: (error: string) => void;
};

const wsUrl = () => wsFromOrigin(runtimeApiOrigin());

const asSnap = (msg: Record<string, unknown>, fallbackId = ''): MatchSnapshot => {
 const banks = msg.banks as {white?: number; black?: number} | undefined;
 const clocks = banks && typeof banks.white === 'number' && typeof banks.black === 'number'
  ? {
     banks: {white: Number(banks.white), black: Number(banks.black)},
     turnStarted: Number(msg.turnStarted ?? 0),
     paused: Boolean(msg.paused),
     serverNow: Number(msg.serverNow ?? 0),
     dropUntil: Number(msg.dropUntil ?? 0),
     timeControl: isTimeControl(msg.timeControl) ? msg.timeControl : '1+0' as const,
    }
  : undefined;
 return {
 matchId: String(msg.matchId ?? fallbackId),
 ply: Number(msg.ply ?? 0),
 turn: (msg.turn === 'black' ? 'black' : 'white') as Side,
 hash: String(msg.hash ?? ''),
 begun: Boolean(msg.begun),
 pieces: Array.isArray(msg.pieces) ? (msg.pieces as MatchSnapshot['pieces']) : [],
 drawCounters: msg.drawCounters as MatchSnapshot['drawCounters'],
 drawOffer: msg.drawOffer === 'white' || msg.drawOffer === 'black' ? msg.drawOffer : null,
 lastDrawOffer: msg.lastDrawOffer === 'white' || msg.lastDrawOffer === 'black' ? msg.lastDrawOffer : null,
 ...(clocks ? {clocks} : {}),
};
};

const RECONNECT_MS = 1000;
const RECONNECT_BUDGET = 3;

export function openLive(handlers: LiveHandlers) {
 let ws: WebSocket | null = null;
 let generation = 0;
 let cancelPending: (() => void) | undefined;
 let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
 let activeMatch = false;
 let reconnectLeft = 0;
 let lastPly = 0;
 let storageKey = '';
 let matchId = '';
 const rememberMatch = (id: string) => {
  matchId = id;
  try {
   if (id) sessionStorage.setItem(storageKey, id);
   else sessionStorage.removeItem(storageKey);
  } catch {}
 };
 const dropAttempt = () => {
  generation++;
  cancelPending?.();
  cancelPending = undefined;
  const socket = ws;
  ws = null;
  try { socket?.close(); } catch {}
 };
 const close = () => {
  activeMatch = false;
  reconnectLeft = 0;
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = undefined; }
  dropAttempt();
 };
 const send = (msg: unknown) => { if (ws?.readyState === 1) ws.send(JSON.stringify(msg)); };
 const api = {
  async connect(): Promise<boolean> {
   dropAttempt();
   const attempt = generation;
   const guest = await ensureGuest();
   if (!guest || attempt !== generation) return false;
   storageKey = `checkers.activeMatch.${guest.id}`;
   try { matchId = sessionStorage.getItem(storageKey) ?? ''; } catch {}
   return await new Promise((resolve) => {
    let socket: WebSocket;
    try { socket = new WebSocket(wsUrl()); ws = socket; } catch { resolve(false); return; }
    const current = () => attempt === generation && ws === socket;
    let settled = false;
    const finish = (ok: boolean) => {
     if (settled) return;
     settled = true;
     clearTimeout(timer);
     if (cancelPending === cancel) cancelPending = undefined;
     if (!ok) {
      if (ws === socket) ws = null;
      try { socket.close(); } catch {}
     }
     resolve(ok);
    };
    const cancel = () => finish(false);
    cancelPending = cancel;
    const timer = setTimeout(cancel, CONNECT_BUDGET_MS);
    socket.onopen = () => { if (current()) socket.send(JSON.stringify({ type: 'auth', token: guest.token, ...(matchId ? {matchId} : {}) })); };
    socket.onerror = () => finish(false);
    socket.onclose = () => {
     finish(false);
     if (ws === socket) ws = null;
     if (attempt !== generation || !activeMatch || reconnectLeft <= 0) return;
     reconnectLeft -= 1;
     reconnectTimer = setTimeout(() => { reconnectTimer = undefined; void api.connect(); }, RECONNECT_MS);
    };
    socket.onmessage = (ev) => {
     if (!current()) return;
     let msg: Record<string, unknown> = {};
     try { msg = JSON.parse(String(ev.data)); } catch { return; }
     const type = String(msg.type ?? '');
     if (type === 'ok') { finish(true); }
     if (type === 'queued') { activeMatch = false; handlers.onQueued?.(); }
     if (type === 'hosted' && msg.matchId) handlers.onHosted?.(String(msg.matchId), msg.code ? String(msg.code) : undefined);
     if (type === 'start' && msg.color) {
      rememberMatch(String(msg.matchId ?? ''));
      lastPly = Number(msg.ply ?? 0);
      activeMatch = true;
      reconnectLeft = RECONNECT_BUDGET;
      handlers.onStart?.(msg.color as Side, String(msg.matchId ?? ''), asSnap(msg, String(msg.matchId ?? '')));
     }
     if (type === 'begin') { lastPly = Number(msg.ply ?? 0); handlers.onBegin?.(asSnap(msg)); }
     if (type === 'state') { lastPly = Number(msg.ply ?? 0); handlers.onState?.(asSnap(msg, String(msg.matchId ?? ''))); }
     if (type === 'draw') handlers.onDraw?.(
      msg.drawOffer === 'white' || msg.drawOffer === 'black' ? msg.drawOffer : null,
      msg.lastDrawOffer === 'white' || msg.lastDrawOffer === 'black' ? msg.lastDrawOffer : null,
     );
     if (type === 'move' && msg.from && msg.path && msg.side) {
      lastPly = Math.max(lastPly, Number(msg.ply ?? 0));
      handlers.onDraw?.(null, undefined);
      const col = (s: string) => s.charCodeAt(0) - 97;
      const row = (s: string) => Number(s.slice(1)) - 1;
      const path = (msg.path as string[]).map((p) => ({ col: col(p), row: row(p) }));
      handlers.onMove?.({
       from: { col: col(String(msg.from)), row: row(String(msg.from)) },
       path,
       ply: Number(msg.ply ?? 0),
       turn: (msg.turn === 'black' ? 'black' : 'white') as Side,
       hash: String(msg.hash ?? ''),
       side: msg.side as Side,
       clocks: asSnap(msg).clocks,
       receivedAt: Date.now(),
      });
     }
     if (type === 'end' && msg.winner) {
      rememberMatch('');
      activeMatch = false;
      reconnectLeft = 0;
      handlers.onEnd?.(msg.winner as Side | 'draw', String(msg.reason ?? ''), msg.youWin as boolean | undefined);
     }
     if (type === 'resume_end' && msg.color && msg.winner) {
      rememberMatch(''); activeMatch = false; reconnectLeft = 0;
      handlers.onRecovered?.(msg.color as Side, asSnap(msg), msg.winner as Side | 'draw', String(msg.reason ?? 'unknown'));
     }
     if (type === 'error' && msg.error) {
      if (msg.error === 'storage_unavailable' || msg.error === 'illegal' || msg.error === 'draw_unavailable') api.requestState();
      handlers.onError?.(String(msg.error));
     }
    };
   });
  },
  queue() { send({ type: 'queue' }); },
  host(timeControl: SelectableTimeControl = defaultTimeControl) { send({ type: 'host', timeControl }); },
  join(matchId: string) { send({ type: 'join', matchId }); },
  ready() { send({ type: 'ready' }); },
  requestState() { send({ type: 'state' }); },
  move(move: IMove) {
   send({ type: 'move', ply: lastPly + 1, from: squareAlg(move.from), path: move.path.map(squareAlg) });
  },
  leave() { send({ type: 'leave' }); },
  resign() { send({ type: 'resign' }); },
  offerDraw() { send({ type: 'draw_offer', ply: lastPly }); },
  acceptDraw() { send({ type: 'draw_accept', ply: lastPly }); },
  declineDraw() { send({ type: 'draw_decline', ply: lastPly }); },
  flag() { send({ type: 'flag' }); },
  isOpen() { return ws?.readyState === 1; },
  close,
 };
 return api;
}
