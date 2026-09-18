import type { IMove, Side } from '@/rules';
import { squareAlg } from './notation';
import { ensureGuest } from './cloud';
import { runtimeApiOrigin, wsUrl as wsFromOrigin } from './apiOrigin';
import { CONNECT_BUDGET_MS } from '@/client/app/matchmakingSearch';
import type { MatchSnapshot } from './matchState';

export type NetMove = IMove & {ply: number; turn: Side; hash: string; side: Side};

export type LiveHandlers = {
 onQueued?: () => void;
 onHosted?: (matchId: string) => void;
 onStart?: (color: Side, matchId: string, snap: MatchSnapshot) => void;
 onBegin?: (snap: MatchSnapshot) => void;
 onState?: (snap: MatchSnapshot) => void;
 onMove?: (move: NetMove) => void;
 onEnd?: (winner: Side | 'draw', reason: string, youWin?: boolean) => void;
 onError?: (error: string) => void;
};

const wsUrl = () => wsFromOrigin(runtimeApiOrigin());

const asSnap = (msg: Record<string, unknown>, fallbackId = ''): MatchSnapshot => ({
 matchId: String(msg.matchId ?? fallbackId),
 ply: Number(msg.ply ?? 0),
 turn: (msg.turn === 'black' ? 'black' : 'white') as Side,
 hash: String(msg.hash ?? ''),
 begun: Boolean(msg.begun),
 pieces: Array.isArray(msg.pieces) ? (msg.pieces as MatchSnapshot['pieces']) : [],
});

export function openLive(handlers: LiveHandlers) {
 let ws: WebSocket | null = null;
 const send = (msg: unknown) => { if (ws?.readyState === 1) ws.send(JSON.stringify(msg)); };
 return {
  async connect(): Promise<boolean> {
   const guest = await ensureGuest();
   if (!guest) return false;
   return await new Promise((resolve) => {
    try { ws = new WebSocket(wsUrl()); } catch { resolve(false); return; }
    let settled = false;
    const finish = (ok: boolean) => {
     if (settled) return;
     settled = true;
     clearTimeout(timer);
     if (!ok) try { ws?.close(); } catch {}
     resolve(ok);
    };
    const timer = setTimeout(() => finish(false), CONNECT_BUDGET_MS);
    ws.onopen = () => send({ type: 'auth', token: guest.token });
    ws.onerror = () => finish(false);
    ws.onmessage = (ev) => {
     let msg: Record<string, unknown> = {};
     try { msg = JSON.parse(String(ev.data)); } catch { return; }
     const type = String(msg.type ?? '');
     if (type === 'ok') { finish(true); }
     if (type === 'queued') handlers.onQueued?.();
     if (type === 'hosted' && msg.matchId) handlers.onHosted?.(String(msg.matchId));
     if (type === 'start' && msg.color) {
      handlers.onStart?.(msg.color as Side, String(msg.matchId ?? ''), asSnap(msg, String(msg.matchId ?? '')));
     }
     if (type === 'begin') handlers.onBegin?.(asSnap(msg));
     if (type === 'state') handlers.onState?.(asSnap(msg, String(msg.matchId ?? '')));
     if (type === 'move' && msg.from && msg.path && msg.side) {
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
      });
     }
     if (type === 'end' && msg.winner) handlers.onEnd?.(msg.winner as Side | 'draw', String(msg.reason ?? ''), msg.youWin as boolean | undefined);
     if (type === 'error' && msg.error) handlers.onError?.(String(msg.error));
    };
   });
  },
  queue() { send({ type: 'queue' }); },
  host() { send({ type: 'host' }); },
  join(matchId: string) { send({ type: 'join', matchId }); },
  ready() { send({ type: 'ready' }); },
  requestState() { send({ type: 'state' }); },
  move(move: IMove) {
   send({ type: 'move', from: squareAlg(move.from), path: move.path.map(squareAlg) });
  },
  leave() { send({ type: 'leave' }); },
  resign() { send({ type: 'resign' }); },
  flag() { send({ type: 'flag' }); },
  isOpen() { return ws?.readyState === 1; },
  close() { try { ws?.close(); } catch {} ws = null; },
 };
}
