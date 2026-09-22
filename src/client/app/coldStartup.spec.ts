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
it('CS-01 early HTML allows queued play but never announces loaded engine', () => {
 vi.useFakeTimers(); const { byId } = boot();
 expect(byId('opening-play').disabled).toBe(false);
 expect(byId('opening-loading-status').textContent).toContain('Загружаем');
 expect(byId('opening-status').hidden).toBe(false);
});
it('CS-01 slow download preserves one-tap intent and offers reload, rather than discarding it', () => {
 vi.useFakeTimers(); const { startup, byId } = boot();
 byId('opening-play').onclick();
 vi.advanceTimersByTime(30001);
 expect(startup.pendingPlay).toBe(true);
 expect(startup.playCommitted).toBe(true);
 expect(byId('opening-retry').hidden).toBe(false);
 expect(byId('opening-loading-status').textContent).toContain('продолжается');
});
it('search copy does not reopen the load-error banner', () => {
 vi.useFakeTimers(); const { startup, byId } = boot();
 startup.ready();
 startup.status('Ищем соперника');
 expect(byId('opening-status').hidden).toBe(true);
 expect(byId('opening-error').textContent).not.toContain('Ищем');
 expect(byId('opening-loading-status').textContent).toContain('Ищем');
});
