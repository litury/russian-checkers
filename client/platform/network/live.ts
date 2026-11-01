import type { IMove, Side } from '@/shared/rules';
import { MATCH_PROTOCOL_VERSION, isMatchResult, type MatchResult } from '@/shared/protocol/matchResult';
import { squareAlg } from '@/shared/protocol/notation';
import { ensureGuest } from './cloud';
import { runtimeApiOrigin, wsUrl as wsFromOrigin } from './apiOrigin';
import { INITIAL_CONNECT_ATTEMPTS, INITIAL_CONNECT_MS, RECOVERY_WINDOW_MS, SOCKET_TIMEOUT_MS, reconnectDelay } from './networkPolicy';
import { recordNetworkDiagnostic } from './networkDiagnostics';
import { ClockSync } from './clockSync';
import type { MatchSnapshot } from '@/shared/protocol/matchState';
import { defaultTimeControl, isTimeControl, type SelectableTimeControl } from '@/shared/rules/timeControl';

export type NetMove = IMove & {ply: number; turn: Side; hash: string; side: Side; clocks?: MatchSnapshot['clocks']};

export type LiveHandlers = {
 onConnectionChange?: (connected: boolean) => void;
 onClock?: (ply: number, clocks: NonNullable<MatchSnapshot['clocks']>) => void;
 onQueued?: () => void;
 onHosted?: (matchId: string, code?: string) => void;
 onStart?: (color: Side, matchId: string, snap: MatchSnapshot) => void;
 onBegin?: (snap: MatchSnapshot) => void;
 onState?: (snap: MatchSnapshot) => void;
 onMove?: (move: NetMove) => void;
 onDraw?: (offer: Side | null, lastOffer?: Side | null) => void;
 onRecovered?: (color: Side, snap: MatchSnapshot, winner: MatchResult, reason: string) => void;
 onEnd?: (winner: MatchResult, reason: string, youWin?: boolean) => void;
 onError?: (error: string) => void;
};

const wsUrl = () => wsFromOrigin(runtimeApiOrigin());

const asSnap = (msg: Record<string, unknown>, fallbackId = ''): MatchSnapshot => {
 const banks = msg.banks as {white?: number; black?: number} | undefined;
 const clocks: MatchSnapshot['clocks'] = banks && typeof banks.white === 'number' && typeof banks.black === 'number'
  ? {
     banks: {white: Number(banks.white), black: Number(banks.black)},
     turnStarted: Number(msg.turnStarted ?? 0),
     paused: Boolean(msg.paused),
     serverPause: msg.serverPause === 'shutdown' || msg.serverPause === 'storage' ? msg.serverPause : undefined,
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

export function openLive(handlers: LiveHandlers) {
 let ws: WebSocket | null = null;
 let generation = 0;
 let cancelPending: (() => void) | undefined;
 let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
 let activeMatch = false;
 let recoveryUntil = 0;
 let recoveryAttempt = 0;
 let recoveryStopped = false;
 let connecting: Promise<boolean> | undefined;
 let connectController: AbortController | undefined;
 let lastPly = 0;
 let storageKey = '';
 let matchId = '';
 const clockSync = new ClockSync();
 let probeTimer: ReturnType<typeof setTimeout> | undefined;
 let pendingProbe: { id: number; sent: number } | undefined;
 let probeSequence = 0;
 let probeReplies = 0;
 let supportsProbes = false;
 let resumeTimer: ReturnType<typeof setTimeout> | undefined;
 let listeners: AbortController | undefined;
 const snap = (msg: Record<string, unknown>, fallbackId = '') => {
  const value = asSnap(msg, fallbackId);
  if (value.clocks) {
   value.clocks.receivedAt = performance.now();
   if (!value.clocks.paused)
    value.clocks.serverNow += clockSync.age(value.clocks.serverNow, value.clocks.receivedAt);
  }
  return value;
 };
 const stopProbes = () => {
  if (probeTimer) clearTimeout(probeTimer);
  if (resumeTimer) clearTimeout(resumeTimer);
  resumeTimer = undefined;
  probeTimer = undefined;
  pendingProbe = undefined;
 };
 const probe = () => {
  if (ws?.readyState !== 1) return;
  if (pendingProbe && supportsProbes && performance.now() - pendingProbe.sent > 8000) {
   ws.close();
   return;
  }
  if (probeTimer) clearTimeout(probeTimer);
  pendingProbe = { id: ++probeSequence, sent: performance.now() };
  send({ type: 'clock_probe', probe: pendingProbe.id });
  probeTimer = setTimeout(probe, 15_000);
 };
 const resume = () => {
  if (!activeMatch || connecting || recoveryStopped || document.visibilityState === 'hidden') return;
  clockSync.reset();
  stopProbes();
  probeReplies = 0;
  handlers.onConnectionChange?.(false);
  if (ws?.readyState === 1) {
   probe();
   api.requestState();
   resumeTimer = setTimeout(() => { if (activeMatch) ws?.close(); }, 8000);
  } else if (ws?.readyState !== 0) {
   if (reconnectTimer) clearTimeout(reconnectTimer);
   reconnectTimer = undefined;
   void api.connect();
  }
 };
 const rememberMatch = (id: string) => {
  matchId = id;
  try {
   if (id) sessionStorage.setItem(storageKey, id);
   else sessionStorage.removeItem(storageKey);
  } catch {}
 };
 const dropAttempt = () => {
  stopProbes();
  clockSync.reset();
  probeReplies = 0;
  generation++;
  cancelPending?.();
  cancelPending = undefined;
  const socket = ws;
  ws = null;
  try { socket?.close(); } catch {}
 };
 const close = () => {
  listeners?.abort();
  listeners = undefined;
  activeMatch = false;
  recoveryStopped = true;
  connectController?.abort();
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = undefined; }
  dropAttempt();
 };
 const send = (msg: unknown) => { if (ws?.readyState === 1) ws.send(JSON.stringify(msg)); };
 const recovered = () => {
  recoveryUntil = 0;
  recoveryAttempt = 0;
 };
 const scheduleRecovery = () => {
  if (!activeMatch || recoveryStopped || reconnectTimer) return;
  if (!recoveryUntil) recoveryUntil = Date.now() + RECOVERY_WINDOW_MS;
  const left = recoveryUntil - Date.now();
  if (left <= 0) return;
  reconnectTimer = setTimeout(() => {
   reconnectTimer = undefined;
   void api.connect();
  }, Math.min(left, reconnectDelay(recoveryAttempt++)));
 };
 const untilCancelled = <Value>(promise: Promise<Value>, signal: AbortSignal): Promise<Value | null> => new Promise(resolve => {
  if (signal.aborted) { resolve(null); return; }
  const cancel = () => resolve(null);
  signal.addEventListener('abort', cancel, { once: true });
  promise.then(value => { signal.removeEventListener('abort', cancel); resolve(value); }, () => { signal.removeEventListener('abort', cancel); resolve(null); });
 });
 const waitToRetry = (delay: number, signal: AbortSignal): Promise<void> => new Promise(resolve => {
  if (signal.aborted) { resolve(); return; }
  const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); };
  const timer = setTimeout(finish, delay);
  signal.addEventListener('abort', finish, { once: true });
 });
 const connectAttempt = async (guest: { id: string; token: string }, signal: AbortSignal, timeout: number): Promise<'connected' | 'retry' | 'stop'> => {
   dropAttempt();
   const attempt = generation;
   storageKey = `checkers.activeMatch.${guest.id}`;
   try { matchId = sessionStorage.getItem(storageKey) ?? ''; } catch {}
   return await new Promise((resolve) => {
    let socket: WebSocket;
    const started = performance.now();
    let phase: 'opening' | 'auth' = 'opening';
    try { socket = new WebSocket(wsUrl()); ws = socket; } catch {
     recoveryStopped = true;
     recordNetworkDiagnostic({ transport: 'websocket', phase, result: 'rejected', elapsedMs: performance.now() - started });
     resolve('stop'); return;
    }
    const current = () => attempt === generation && ws === socket;
    let settled = false;
    let authenticated = false;
    const finish = (result: 'connected' | 'retry' | 'stop', diagnostic: 'ok' | 'timeout' | 'cancelled' | 'network' | 'rejected' | 'closed', closeCode?: number) => {
     if (settled) return;
     settled = true;
     authenticated = result === 'connected';
     if (result === 'stop' && diagnostic === 'rejected') recoveryStopped = true;
     clearTimeout(timer);
     signal.removeEventListener('abort', cancel);
     recordNetworkDiagnostic({ transport: 'websocket', phase, result: diagnostic, elapsedMs: performance.now() - started, ...(closeCode === undefined ? {} : { closeCode }) });
     if (cancelPending === cancel) cancelPending = undefined;
     if (!authenticated) {
      if (ws === socket) ws = null;
      try { socket.close(); } catch {}
     }
     resolve(result);
    };
    const cancel = () => finish('stop', signal.reason?.name === 'TimeoutError' ? 'timeout' : 'cancelled');
    cancelPending = cancel;
    const timer = setTimeout(() => finish('retry', 'timeout'), timeout);
    signal.addEventListener('abort', cancel, { once: true });
    socket.onopen = () => { if (current()) { phase = 'auth'; socket.send(JSON.stringify({ type: 'auth', protocol: MATCH_PROTOCOL_VERSION, token: guest.token, ...(matchId ? {matchId} : {}) })); } };
    socket.onerror = () => { if (!authenticated) finish('retry', 'network'); else if (current()) socket.close(); };
    socket.onclose = (event) => {
     const wasCurrent = current();
     if (wasCurrent) stopProbes();
     const rejected = [1002, 1003, 1007, 1008, 1009, 1010].includes(event.code);
     if (!authenticated) { finish(rejected ? 'stop' : 'retry', rejected ? 'rejected' : 'closed', event.code); return; }
     if (ws === socket) ws = null;
     if (!wasCurrent) return;
     recordNetworkDiagnostic({ transport: 'websocket', phase: 'connected', result: rejected ? 'rejected' : 'closed', closeCode: event.code, elapsedMs: performance.now() - started });
     if (rejected) recoveryStopped = true;
     if (activeMatch) handlers.onConnectionChange?.(false);
     else handlers.onError?.('connection_lost');
     scheduleRecovery();
    };
    socket.onmessage = (ev) => {
     if (!current()) return;
     let msg: Record<string, unknown> = {};
     try { msg = JSON.parse(String(ev.data)); } catch { return; }
     const type = String(msg.type ?? '');
     if (type === 'ok' && !authenticated) {
      finish('connected', 'ok');
      probe();
      if (activeMatch) resumeTimer = setTimeout(() => { if (activeMatch) socket.close(); }, Math.min(SOCKET_TIMEOUT_MS, Math.max(0, recoveryUntil - Date.now())));
     }
     if (type === 'error' && !authenticated) {
      finish('stop', 'rejected');
      handlers.onError?.(String(msg.error ?? 'unauthorized'));
      return;
     }
     if (type === 'clock_probe' && pendingProbe && msg.probe === pendingProbe.id) {
      supportsProbes = true;
      const accepted = clockSync.record(pendingProbe.sent, performance.now(), Number(msg.serverReceived), Number(msg.serverNow));
      pendingProbe = undefined;
      if (accepted) {
       probeReplies++;
       const clocks = snap(msg).clocks;
       if (activeMatch && clocks && Number.isSafeInteger(msg.ply)) handlers.onClock?.(Number(msg.ply), clocks);
      }
      if (probeReplies < 3) {
       if (probeTimer) clearTimeout(probeTimer);
       probeTimer = setTimeout(probe, 250);
      }
     }
     if (type === 'queued') { activeMatch = false; handlers.onQueued?.(); }
     if (type === 'hosted' && msg.matchId) handlers.onHosted?.(String(msg.matchId), msg.code ? String(msg.code) : undefined);
     if (type === 'start' && msg.color) {
      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = undefined;
      rememberMatch(String(msg.matchId ?? ''));
      lastPly = Number(msg.ply ?? 0);
      activeMatch = true;
      recovered();
      handlers.onStart?.(msg.color as Side, String(msg.matchId ?? ''), snap(msg, String(msg.matchId ?? '')));
      handlers.onConnectionChange?.(true);
     }
     if (type === 'begin') { lastPly = Number(msg.ply ?? 0); handlers.onBegin?.(snap(msg)); }
     if (type === 'state') {
      recovered();
      if (resumeTimer) clearTimeout(resumeTimer);
      resumeTimer = undefined;
      lastPly = Number(msg.ply ?? 0);
      handlers.onState?.(snap(msg, String(msg.matchId ?? '')));
      handlers.onConnectionChange?.(true);
     }
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
       clocks: snap(msg).clocks,
      });
     }
     if (type === 'end' && isMatchResult(msg.winner)) {
      stopProbes();
      rememberMatch('');
      activeMatch = false;
      recovered();
      handlers.onEnd?.(msg.winner, String(msg.reason ?? ''), msg.youWin as boolean | undefined);
     }
     if (type === 'resume_end' && msg.color && isMatchResult(msg.winner)) {
      stopProbes();
      rememberMatch(''); activeMatch = false; recovered();
      handlers.onRecovered?.(msg.color as Side, asSnap(msg), msg.winner, String(msg.reason ?? 'unknown'));
     }
     if (type === 'error' && msg.error) {
      if (msg.error === 'unauthorized' || msg.error === 'update_required' || msg.error === 'rate') {
       recoveryStopped = true;
       socket.close();
      }
      if (msg.error === 'illegal' || msg.error === 'draw_unavailable') api.requestState();
      handlers.onError?.(String(msg.error));
     }
    };
   });
 };
 const connectWithinBudget = async (controller: AbortController): Promise<boolean> => {
  const recovering = activeMatch;
  if (recovering && recoveryStopped) return false;
  if (recovering && !recoveryUntil) recoveryUntil = Date.now() + RECOVERY_WINDOW_MS;
  const deadline = recovering ? recoveryUntil : Date.now() + INITIAL_CONNECT_MS;
  const started = performance.now();
  const left = deadline - Date.now();
  if (left <= 0) return false;
  const timer = setTimeout(() => controller.abort(new DOMException('Connection deadline', 'TimeoutError')), left);
  try {
   const guest = await untilCancelled(ensureGuest(), controller.signal);
   if (!guest || controller.signal.aborted) {
    recordNetworkDiagnostic({ transport: 'websocket', phase: 'guest', result: controller.signal.aborted ? controller.signal.reason?.name === 'TimeoutError' ? 'timeout' : 'cancelled' : 'rejected', elapsedMs: performance.now() - started });
    return false;
   }
   let attempt = 0;
   while (!controller.signal.aborted && Date.now() < deadline && (recovering || attempt < INITIAL_CONNECT_ATTEMPTS)) {
    const result = await connectAttempt(guest, controller.signal, Math.min(SOCKET_TIMEOUT_MS, deadline - Date.now()));
    if (result === 'connected') return true;
    if (result === 'stop') return false;
    attempt++;
    if (!recovering && attempt >= INITIAL_CONNECT_ATTEMPTS) break;
    await waitToRetry(Math.min(deadline - Date.now(), reconnectDelay(recovering ? recoveryAttempt++ : attempt - 1)), controller.signal);
   }
   recordNetworkDiagnostic({ transport: 'websocket', phase: recovering ? 'recovery' : 'opening', result: 'timeout', elapsedMs: performance.now() - started });
   return false;
  } finally { clearTimeout(timer); }
 };
 const api = {
  connect(): Promise<boolean> {
   if (connecting) return connecting;
   if (!listeners) {
    listeners = new AbortController();
    recoveryStopped = false;
    document.addEventListener('visibilitychange', resume, { signal: listeners.signal });
    window.addEventListener('pageshow', resume, { signal: listeners.signal });
    window.addEventListener('online', resume, { signal: listeners.signal });
   }
   const controller = new AbortController();
   connectController = controller;
   connecting = connectWithinBudget(controller).finally(() => {
    if (connectController === controller) connectController = undefined;
    connecting = undefined;
   });
   return connecting;
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
