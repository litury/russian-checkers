import { afterEach, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: { Scene: class {} } }));
import { GameScene } from './gameScene';
import { searchCopy } from './matchmakingSearch';

afterEach(() => vi.useRealTimers());
it('connection failure stays visible until an explicit retry or exit', () => {
 vi.useFakeTimers();
 const s = new GameScene() as any;
 s.time = { now: 0, delayedCall: (ms: number, fn: () => void) => setTimeout(fn, ms) };
 s.title = { setSearch: vi.fn(), clearSearch: vi.fn() };
 s.live = { close: vi.fn() };
 vi.stubGlobal('window', { checkersStartup: { unlock: vi.fn() } });
 try {
  const close = s.live.close;
  s.markSearchOffline();
  vi.advanceTimersByTime(10000);
  expect(s.searchPhase).toBe('offline');
  expect(s.title.clearSearch).not.toHaveBeenCalled();
  expect(close).toHaveBeenCalledOnce();
  expect(s.live).toBeNull();
  expect(searchCopy('offline', 0)).toMatchObject({ showFind: true, showCancel: true });
  s.cancelSearch();
  expect(s.searchPhase).toBe('idle');
  expect(s.title.clearSearch).toHaveBeenCalledOnce();
 } finally { vi.unstubAllGlobals(); }
});
