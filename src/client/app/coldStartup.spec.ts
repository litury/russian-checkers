import { afterEach, expect, it, vi } from 'vitest';
import html from '../../../index.html?raw';

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
