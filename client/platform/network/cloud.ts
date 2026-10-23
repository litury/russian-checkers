import type { Side } from '@/shared/rules';
import { squareAlg } from '@/shared/protocol/notation';
import { isMatchRow } from '@/shared/protocol/matchHistory';
import type { IMove } from '@/shared/rules';
import { runtimeApiOrigin } from './apiOrigin';
import { CONNECT_BUDGET_MS } from './networkPolicy';
import type { TimeControlId } from '@/shared/rules/timeControl';

const api = () => runtimeApiOrigin();

const tokenKey = 'checkers.playerToken';
const idKey = 'checkers.playerId';

export type CloudPly = { side: Side; from: IMove['from']; path: IMove['path'] };

async function request(path: string, init: RequestInit = {}): Promise<Response | null> {
 try {
  return await fetch(`${api()}${path}`, {
   ...init,
   signal: init.signal ?? AbortSignal.timeout(CONNECT_BUDGET_MS),
   headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
 } catch {
  return null;
 }
}

export async function probeApi(): Promise<boolean> {
 const res = await request('/health', { method: 'GET' });
 return !!res?.ok;
}

let guestRequest: Promise<{id: string; token: string} | null> | undefined;
export async function ensureGuest(): Promise<{ id: string; token: string } | null> {
 if (guestRequest) return guestRequest;
 guestRequest = createGuest();
 try { return await guestRequest; }
 finally { guestRequest = undefined; }
}
async function createGuest(): Promise<{ id: string; token: string } | null> {
 try {
  const token = localStorage.getItem(tokenKey);
  const id = localStorage.getItem(idKey);
  if (token && id) return { id, token };
 } catch {}
 const res = await request('/players/guest', { method: 'POST', body: '{}' });
 if (!res?.ok) return null;
 // Fetch resolves at headers; the body can still fail when its signal expires.
 let body: { id: string; token: string };
 try {
  body = await res.json();
 } catch {
  return null;
 }
 try {
  localStorage.setItem(tokenKey, body.token);
  localStorage.setItem(idKey, body.id);
 } catch {}
 return body;
}

export async function recordBotMatch(opts: {
 timeControl: TimeControlId;
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
   timeControl: opts.timeControl,
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

export async function loadColorStats(): Promise<{ white: number; black: number; games: number } | null> {
 const res = await request('/stats/colors');
 if (!res?.ok) return null;
 try {
  const body = (await res.json()) as { white?: unknown; black?: unknown; games?: unknown };
  const { white, black, games } = body;
  if (![white, black, games].every((n) => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0)) return null;
  return { white: white as number, black: black as number, games: games as number };
 } catch {
  return null;
 }
}

export async function loadPresence(signal?: AbortSignal): Promise<number | null> {
 const res = await request('/stats/presence', {signal});
 if (!res?.ok) return null;
 try {
  const live = (await res.json() as {live?: unknown}).live;
  return typeof live === 'number' && Number.isSafeInteger(live) && live >= 0 ? live : null;
 } catch {
  return null;
 }
}

const tabKey = 'checkers.presenceTab';
function presenceTab(): string {
 try {
  let tab = sessionStorage.getItem(tabKey);
  if (!tab) {
   tab = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
   sessionStorage.setItem(tabKey, tab);
  }
  return tab;
 } catch {
  return 'tab';
 }
}

export async function beatPresence(on = true, signal?: AbortSignal): Promise<number | null> {
 const guest = await ensureGuest();
 if (!guest || signal?.aborted) return null;
 const res = await request('/stats/presence', {
  signal,
  method: 'POST',
  keepalive: true,
  headers: { authorization: `Bearer ${guest.token}` },
  body: JSON.stringify({on, tab: presenceTab()}),
 });
 if (!res?.ok) return null;
 try {
  const live = (await res.json() as {live?: unknown}).live;
  return typeof live === 'number' && Number.isSafeInteger(live) && live >= 0 ? live : null;
 } catch {
  return null;
 }
}

export async function loadStats(identity?: { id: string; token: string }): Promise<{ games: number; white_wins: number; black_wins: number } | null> {
 const guest = identity ?? await ensureGuest();
 if (!guest) return null;
 const res = await request(`/players/${guest.id}/stats`);
 if (!res?.ok) return null;
 try {
  return await res.json();
 } catch {
  return null;
 }
}

export async function loadMatches(): Promise<import('@/shared/protocol/matchHistory').MatchRow[] | null> {
 try {
  const guest = await ensureGuest();
  if (!guest) return null;
  const res = await request('/matches', { headers: { authorization: `Bearer ${guest.token}` } });
  if (!res?.ok) return null;
  const body = await res.json();
  return Array.isArray(body?.matches) && body.matches.every(isMatchRow) ? body.matches : null;
 } catch { return null; }
}

export type HistoryDetailResult =
 | { status: 'ok'; detail: import('@/shared/protocol/matchHistory').MatchDetail }
 | { status: 'missing' }
 | { status: 'error' };

export async function loadMatch(id: string): Promise<HistoryDetailResult> {
 try {
  const guest = await ensureGuest();
  if (!guest) return { status: 'error' };
  const res = await request(`/matches/${encodeURIComponent(id)}`, { headers: { authorization: `Bearer ${guest.token}` } });
  if (res?.status === 404) return { status: 'missing' };
  if (!res?.ok) return { status: 'error' };
  const body = await res.json();
  if (!isMatchRow(body) || body.id !== id || !Array.isArray((body as import('@/shared/protocol/matchHistory').MatchDetail).pliesList)) return { status: 'error' };
  return { status: 'ok', detail: body as import('@/shared/protocol/matchHistory').MatchDetail };
 } catch { return { status: 'error' }; }
}
