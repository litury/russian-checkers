import type { Side } from '@/shared/rules';
import { squareAlg } from '@/shared/protocol/notation';
import { isMatchRow } from '@/shared/protocol/matchHistory';
import type { IMove } from '@/shared/rules';
import { runtimeApiOrigin } from './apiOrigin';
import { HTTP_TIMEOUT_MS } from './networkPolicy';
import { recordNetworkDiagnostic } from './networkDiagnostics';
import { requestDeadline } from './requestDeadline';
import type { TimeControlId } from '@/shared/rules/timeControl';
import type { ClockBanks } from '@/shared/protocol/clockBanks';

const api = () => runtimeApiOrigin();

const tokenKey = 'checkers.playerToken';
const idKey = 'checkers.playerId';

export class EmailRequestError extends Error {}

export async function emailRequestAsync<T>(_path: string, _body?: unknown): Promise<T> {
 const guest = await ensureGuest();
 if (!guest) throw new EmailRequestError('network');
 const response = await request(`/auth/email/${_path}`, {
  method: _body === undefined ? 'GET' : 'POST',
  headers: { authorization: `Bearer ${guest.token}` },
  ...(_body === undefined ? {} : {body: JSON.stringify(_body)}),
 });
 if (!response) throw new EmailRequestError('network');
 let result;
 try { result = await response.json(); }
 catch { throw new EmailRequestError('network'); }
 if (!response.ok) throw new EmailRequestError(typeof result?.error === 'string' ? result.error : 'network');
 return result as T;
}

export function saveEmailSession(_id: string, _token: string) {
 const previousId = localStorage.getItem(idKey);
 const previousToken = localStorage.getItem(tokenKey);
 try {
  localStorage.setItem(tokenKey, _token);
  localStorage.setItem(idKey, _id);
 } catch {
  try {
   if (previousToken) localStorage.setItem(tokenKey, previousToken);
   else localStorage.removeItem(tokenKey);
   if (previousId) localStorage.setItem(idKey, previousId);
   else localStorage.removeItem(idKey);
  } catch {}
  throw new EmailRequestError('storage');
 }
}

export type CloudPly = { side: Side; from: IMove['from']; path: IMove['path']; clocks?: ClockBanks };

async function request(path: string, init: RequestInit = {}): Promise<Response | null> {
 const started = performance.now();
 const deadline = requestDeadline(HTTP_TIMEOUT_MS, init.signal);
 const signal = deadline.signal;
 try {
  const response = await fetch(`${api()}${path}`, {
   ...init,
   signal,
   headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
  });
  if (!response.ok) recordNetworkDiagnostic({ transport: 'http', phase: 'request', result: 'rejected', status: response.status, elapsedMs: performance.now() - started });
  return response;
 } catch {
  recordNetworkDiagnostic({ transport: 'http', phase: 'request', result: deadline.timedOut() ? 'timeout' : signal.aborted ? 'cancelled' : 'network', elapsedMs: performance.now() - started });
  deadline.dispose();
  return null;
 }
}

let guestRequest: Promise<{id: string; token: string} | null> | undefined;
let guestError = 'connection_lost';
export const guestFailure = () => guestError;
export async function ensureGuest(): Promise<{ id: string; token: string } | null> {
 if (guestRequest) return guestRequest;
 guestRequest = createGuest();
 try { return await guestRequest; }
 finally { guestRequest = undefined; }
}
async function createGuest(): Promise<{ id: string; token: string } | null> {
 guestError = 'connection_lost';
 try {
  const token = localStorage.getItem(tokenKey);
  const id = localStorage.getItem(idKey);
  if (token && id) return { id, token };
 } catch {}
 const res = await request('/players/guest', { method: 'POST', body: '{}' });
 if (!res?.ok) {
  if (res?.status === 429) guestError = 'rate';
  return null;
 }
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
 endReason?: string;
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
   endReason: opts.endReason,
   plies: opts.plies.map((p) => ({
    side: p.side,
    from: squareAlg(p.from),
    path: p.path.map(squareAlg),
    clocks: p.clocks,
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

export async function loadStats(identity?: { id: string; token: string }): Promise<{ games: number; white_wins: number; black_wins: number; rating?: import('@/shared/protocol/rating').RatingSummary } | null> {
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
