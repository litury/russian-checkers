import type { IMove, Side } from '@/rules';
import { squareAlg } from './notation';
import { ensureGuest } from './cloud';
import { runtimeApiOrigin, wsUrl as wsFromOrigin } from './apiOrigin';
import { CONNECT_BUDGET_MS } from '@/client/app/matchmakingSearch';

export type LiveHandlers = {
 onQueued?: () => void;
 onStart?: (color: Side, matchId: string) => void;
 onMove?: (move: IMove, side: Side) => void;
 onEnd?: (winner: Side | 'draw', reason: string, youWin?: boolean) => void;
 onError?: (error: string) => void;
};

const wsUrl = () => wsFromOrigin(runtimeApiOrigin());

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
     let msg: {type?: string; color?: Side; matchId?: string; from?: string; path?: string[]; side?: Side; winner?: Side | 'draw'; youWin?: boolean; reason?: string; error?: string} = {};
     try { msg = JSON.parse(String(ev.data)); } catch { return; }
     if (msg.type === 'ok') { finish(true); }
     if (msg.type === 'queued') handlers.onQueued?.();
     if (msg.type === 'start' && msg.color) handlers.onStart?.(msg.color, msg.matchId ?? '');
     if (msg.type === 'move' && msg.from && msg.path && msg.side) {
      const col = (s: string) => s.charCodeAt(0) - 97;
      const row = (s: string) => Number(s.slice(1)) - 1;
      handlers.onMove?.({ from: { col: col(msg.from), row: row(msg.from) }, path: msg.path.map((p) => ({ col: col(p), row: row(p) })) }, msg.side);
     }
     if (msg.type === 'end' && msg.winner) handlers.onEnd?.(msg.winner, msg.reason ?? '', msg.youWin);
     if (msg.type === 'error' && msg.error) handlers.onError?.(msg.error);
    };
   });
  },
  queue() { send({ type: 'queue' }); },
  move(move: IMove) {
   send({ type: 'move', from: squareAlg(move.from), path: move.path.map(squareAlg) });
  },
  leave() { send({ type: 'leave' }); },
  resign() { send({ type: 'resign' }); },
  isOpen() { return ws?.readyState === 1; },
  close() { try { ws?.close(); } catch {} ws = null; },
 };
}
