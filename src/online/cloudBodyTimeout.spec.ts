import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { beatPresence, ensureGuest, loadStats, recordBotMatch } from './cloud';

let values: Map<string, string>;
beforeEach(() => {
 values = new Map();
 vi.stubGlobal('localStorage', {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value),
 });
});
afterEach(() => vi.unstubAllGlobals());

function delayedBodyFailure(error: Error) {
 const json = vi.fn(() => new Promise((_, reject) => setTimeout(() => reject(error), 10)));
 const fetch = vi.fn().mockResolvedValue({ ok: true, json });
 vi.stubGlobal('fetch', fetch);
 return { fetch, json };
}

it.each([
 ['ensureGuest', () => ensureGuest(), null],
 ['beatPresence', () => beatPresence(), null],
 ['recordBotMatch', () => recordBotMatch({ humanSide: 'white', winner: 'draw', plies: [] }), undefined],
 ['loadStats guest', () => loadStats(), null],
] as const)('%s handles a body timeout after successful headers without persisting credentials', async (_, call, result) => {
 const { fetch, json } = delayedBodyFailure(new DOMException('signal timed out', 'TimeoutError'));
 await expect(call()).resolves.toBe(result);
 expect(fetch).toHaveBeenCalledTimes(1);
 expect(json).toHaveBeenCalledTimes(1);
 expect(values.size).toBe(0);
});

it('retries guest creation after a failed body, then caches only the successful response', async () => {
 const { fetch } = delayedBodyFailure(new DOMException('signal timed out', 'TimeoutError'));
 await expect(ensureGuest()).resolves.toBeNull();
 const guest = { id: 'test-player', token: 'test-only-token' };
 fetch.mockResolvedValueOnce({ ok: true, json: async () => guest });
 await expect(ensureGuest()).resolves.toEqual(guest);
 await expect(ensureGuest()).resolves.toEqual(guest);
 expect(fetch).toHaveBeenCalledTimes(2);
 expect(values.get('checkers.playerId')).toBe(guest.id);
 expect(values.get('checkers.playerToken')).toBe(guest.token);
});

it.each([
 new DOMException('signal timed out', 'TimeoutError'),
 new SyntaxError('invalid JSON'),
])('loadStats handles body failure and retries without replacing statistics', async (error) => {
 values.set('checkers.playerId', 'test-player');
 values.set('checkers.playerToken', 'test-only-token');
 const { fetch } = delayedBodyFailure(error);
 await expect(loadStats()).resolves.toBeNull();
 const stats = { games: 7, white_wins: 3, black_wins: 2 };
 fetch.mockResolvedValueOnce({ ok: true, json: async () => stats });
 await expect(loadStats()).resolves.toEqual(stats);
 expect(fetch).toHaveBeenCalledTimes(2);
});

it('ensureGuest handles malformed JSON without caching a guest', async () => {
 delayedBodyFailure(new SyntaxError('invalid JSON'));
 await expect(ensureGuest()).resolves.toBeNull();
 expect(values.size).toBe(0);
});
