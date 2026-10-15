import {expect, it, vi} from 'vitest';
import ts from 'typescript';
import source from './openingOverlay.ts?raw';

it('waits for delayed leave before return and ignores a superseded return', async () => {
 const calls: boolean[] = [];
 let release!: () => void;
 const leave = new Promise<void>(resolve => { release = resolve; });
 let live = 1;
 const beatPresence = vi.fn(async (on: boolean) => {
  calls.push(on);
  if (!on) await leave;
  live = on ? 1 : 0;
  return live;
 });
 const window = {setTimeout: vi.fn(), clearTimeout: vi.fn()};
 const document = {hidden: false};
 const showLive = vi.fn();
 const section = source.slice(source.indexOf(' let beatTimer:'), source.indexOf(' const startPresence ='));
 const js = ts.transpile(`let liveTotal; ${section}; return {startBeat, stopBeat, leavePresence};`, {target: ts.ScriptTarget.ES2022});
 const lifecycle = new Function('beatPresence', 'loadPresence', 'window', 'document', 'HEARTBEAT_MS', 'renderLive', js)(beatPresence, vi.fn(), window, document, 8000, showLive);
 const flush = async () => { for(let i=0;i<12;i++) await Promise.resolve(); };
 lifecycle.startBeat();await flush();
 expect(calls).toEqual([true]);
 lifecycle.stopBeat();lifecycle.leavePresence();await flush();
 lifecycle.startBeat();await flush();
 expect(calls).toEqual([true,false]);
 // Another lifecycle transition while return is waiting must not add a poll.
 lifecycle.stopBeat();lifecycle.startBeat();await flush();
 release();await flush();
 expect(calls).toEqual([true,false,true]);
 expect(live).toBe(1);
 expect(window.setTimeout).toHaveBeenCalledTimes(2);
});
