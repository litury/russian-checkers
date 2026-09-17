import type { Side } from '@/rules';
import { squareAlg } from './notation';
import type { IMove } from '@/rules';
import { runtimeApiOrigin } from './apiOrigin';

const api = () => runtimeApiOrigin();

const tokenKey = 'checkers.playerToken';
const idKey = 'checkers.playerId';

export type CloudPly = { side: Side; from: IMove['from']; path: IMove['path'] };

async function request(path: string, init: RequestInit = {}): Promise<Response | null> {
 try {
  return await fetch(`${api()}${path}`, {
   ...init,
   headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
 } catch {
  return null;
 }
}

export async function ensureGuest(): Promise<{ id: string; token: string } | null> {
 try {
  const token = localStorage.getItem(tokenKey);
  const id = localStorage.getItem(idKey);
  if (token && id) return { id, token };
 } catch {}
 const res = await request('/players/guest', { method: 'POST', body: '{}' });
 if (!res?.ok) return null;
 const body = (await res.json()) as { id: string; token: string };
 try {
  localStorage.setItem(tokenKey, body.token);
  localStorage.setItem(idKey, body.id);
 } catch {}
 return body;
}

export async function recordBotMatch(opts: {
 humanSide: Side;
 winner: Side | 'draw';
 plies: CloudPly[];
}): Promise<void> {
 const guest = await ensureGuest();
 if (!guest) return;
 await request('/matches', {
  method: 'POST',
  headers: { authorization: `Bearer ${guest.token}` },
  body: JSON.stringify({
   mode: 'bot',
   humanSide: opts.humanSide,
   winner: opts.winner,
   plies: opts.plies.map((p) => ({
    side: p.side,
    from: squareAlg(p.from),
    path: p.path.map(squareAlg),
   })),
  }),
 });
}

export async function loadStats(): Promise<{ games: number; white_wins: number; black_wins: number } | null> {
 const guest = await ensureGuest();
 if (!guest) return null;
 const res = await request(`/players/${guest.id}/stats`);
 if (!res?.ok) return null;
 return res.json();
}
