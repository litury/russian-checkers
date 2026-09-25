import { afterEach, expect, it, vi } from 'vitest';
import html from '../../../index.html?raw';
import { readPerf, resetPerf } from './perfMarks';
import { notePlayIntent, playIntentEvent } from './playIntent';

function boot() {
 const nodes = new Map<string, any>();
 const byId = (id: string) => {
  if (!nodes.has(id)) nodes.set(id, { hidden: false, disabled: true, textContent: '', setAttribute: vi.fn(), removeAttribute: vi.fn() });
  return nodes.get(id);
 };
 const window: any = { checkersFlavor: { setState: vi.fn() } };
 const code = html.slice(html.indexOf(" const play = byId('opening-play');"), html.indexOf('})();\n</script>', html.indexOf(" const play = byId('opening-play');")));
 new Function('window','byId', code)(window, byId);
 return { startup: window.checkersStartup, byId };
}
afterEach(() => vi.useRealTimers());
it('CS-01 early HTML allows queued play but never announces loaded engine or a load plaque', () => {
 vi.useFakeTimers(); const { byId } = boot();
 expect(byId('opening-play').disabled).toBe(false);
 expect(byId('opening-play').hidden).toBe(false);
 expect(byId('opening-loading-status').textContent).toContain('Загружаем');
 expect(byId('opening-status').hidden).toBe(true);
 expect(byId('opening-error').textContent).not.toContain('Загружаем');
});
it('pressed machine CTA waits on itself and leaves the other button alone', () => {
 vi.useFakeTimers(); const { startup, byId } = boot();
 const online = byId('opening-online');
 online.textContent = 'С человеком';
 online.disabled = false;
 byId('opening-play').onclick();
 expect(startup.playCommitted).toBe(true);
 expect(startup.source).toBe('play');
 expect(byId('opening-play').disabled).toBe(true);
 expect(byId('opening-play').textContent).toBe('Загрузка…');
 expect(byId('opening-play').setAttribute).toHaveBeenCalledWith('aria-busy', 'true');
 expect(byId('opening-status').hidden).toBe(true);
 expect(online.disabled).toBe(false);
 expect(online.textContent).toBe('С человеком');
});
it('pressed human CTA waits on itself and does not arm the machine button', () => {
 vi.useFakeTimers(); const { startup, byId } = boot();
 const play = byId('opening-play');
 const playText = play.textContent;
 byId('opening-online').onclick();
 expect(startup.pendingOnline).toBe(true);
 expect(startup.playCommitted).toBe(false);
 expect(startup.source).toBe('online');
 expect(byId('opening-online').disabled).toBe(true);
 expect(byId('opening-online').textContent).toBe('Загрузка…');
 expect(byId('opening-status').hidden).toBe(true);
 expect(play.disabled).toBe(false);
 expect(play.textContent).toBe(playText);
});
it('CS-01 slow download preserves one-tap intent and does not cover Play', () => {
 vi.useFakeTimers(); const { startup, byId } = boot();
 byId('opening-play').onclick();
 vi.advanceTimersByTime(30001);
 expect(startup.pendingPlay).toBe(true);
 expect(startup.playCommitted).toBe(true);
 expect(byId('opening-play').hidden).toBe(false);
 expect(byId('opening-retry').hidden).toBe(true);
 expect(byId('opening-loading-status').textContent).toBe('Загрузка продолжается. Можно подождать.');
});
it('idle watchdog does not reveal Retry over an already available Play CTA', () => {
 vi.useFakeTimers(); const { byId } = boot();
 expect(byId('opening-play').disabled).toBe(false);
 expect(byId('opening-play').hidden).toBe(false);
 vi.advanceTimersByTime(12000);
 expect(byId('opening-retry').hidden).toBe(true);
 expect(byId('opening-play').hidden).toBe(false);
 expect(byId('opening-play').disabled).toBe(false);
 expect(byId('opening-loading-status').textContent).toBe('Загрузка продолжается. Можно подождать или начать игру.');
});
it('import failure still hides Play and shows Retry in that slot', () => {
 vi.useFakeTimers(); const { startup, byId } = boot();
 startup.fail('Не удалось запустить игру.');
 expect(byId('opening-play').hidden).toBe(true);
 expect(byId('opening-retry').hidden).toBe(false);
 expect(byId('opening-error').hidden).toBe(false);
});
it('search copy does not reopen the load-error banner', () => {
 vi.useFakeTimers(); const { startup, byId } = boot();
 startup.ready();
 startup.status('Ищем соперника');
 expect(byId('opening-status').hidden).toBe(true);
 expect(byId('opening-error').textContent).not.toContain('Ищем');
 expect(byId('opening-loading-status').textContent).toContain('Ищем');
});
it('stores the press instant when «Играть» is pressed before the engine loads', () => {
 vi.useFakeTimers(); const { startup, byId } = boot();
 byId('opening-play').onclick({ timeStamp: 137 });
 expect(startup.pendingPlay).toBe(true);
 expect(startup.playIntentAt).toBe(137);
});
it('stores the press instant for the pre-engine human CTA too', () => {
 vi.useFakeTimers(); const { startup, byId } = boot();
 byId('opening-online').onclick({ timeStamp: 214 });
 expect(startup.pendingOnline).toBe(true);
 expect(startup.onlineIntentAt).toBe(214);
});
it('leaves a click that already reached the engine untouched', () => {
 vi.useFakeTimers(); const { startup, byId } = boot();
 const seen: Array<Event | undefined> = [];
 startup.playIntent = (event?: Event) => seen.push(event);
 const event = { timeStamp: 2600 } as Event;
 byId('opening-play').onclick(event);
 expect(seen).toEqual([event]);
 expect(startup.playIntentAt).toBe(null);
});
it('a cold HTML press reaches the engine timeline with the original instant', () => {
 vi.useFakeTimers(); resetPerf();
 const { startup, byId } = boot();
 // The engine modules are still loading while the player presses the CTA …
 vi.advanceTimersByTime(2500);
 byId('opening-play').onclick({ timeStamp: 137 });
 // … and the engine replays exactly what the HTML script captured for that press.
 notePlayIntent(playIntentEvent(startup.playIntentAt));
 const { marks, measures } = readPerf();
 expect(marks['play-intent']).toBeCloseTo(137, 3);
 expect(marks['play-handled']).toBeGreaterThanOrEqual(2500);
 expect(measures['play-input-delay']).toBeGreaterThanOrEqual(2000);
});
