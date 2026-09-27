import { afterEach, expect, it, vi } from 'vitest';
import html from '../../../index.html?raw';

// Execute the shipping classic script: it must work even if every module stalls.
const script = html.match(/<script id="opening-menu-readiness">([\s\S]*?)<\/script>/)![1];
const flush = async () => { for (let i = 0; i < 16; i++) await Promise.resolve(); };
function boot() {
 vi.useFakeTimers();
 const pending: { resolve: () => void; reject: () => void }[] = [];
 class ImagePort extends EventTarget {
  complete = true; naturalWidth = 724; src = 'art.webp'; currentSrc = 'responsive.webp'; loading = '';
  classList = { add: vi.fn() }; removeAttribute = vi.fn();
  decode() { return new Promise<void>((resolve, reject) => pending.push({resolve, reject: () => reject(new Error('decode'))})); }
 }
 const images = Array.from({length:5}, () => new ImagePort());
 const title = new ImagePort();
 const classes = new Set<string>();
 const root = Object.assign(new EventTarget(), {
  hidden: false, dataset: {menuState:'loading', menuReason:''},
  classList: {add: (s: string) => classes.add(s), contains: (s: string) => classes.has(s)},
  querySelectorAll: () => images,
  querySelector: (s: string) => s === '.siege-cartouche' ? title : {classList:{add:vi.fn()}}
 });
 const window = new EventTarget();
 const doc = {getElementById: () => root, querySelector: () => ({href:'steel.webp'}), documentElement:{dataset:{titleFont:'pending'}}, fonts:{load:vi.fn(() => Promise.resolve([{}]))}};
 let observe: () => void = () => {};
 const disconnect = vi.fn();
 const Observer = class {constructor(fn:()=>void){observe=fn;} observe(){} disconnect=disconnect;};
 const mark = vi.fn();
 new Function('document','window','Image','MutationObserver','getComputedStyle','requestAnimationFrame','performance',script)(
  doc,window,ImagePort,Observer,() => ({borderImageSource:'url("frame.webp")',backgroundImage:'none'}),(fn:()=>void) => fn(),{mark});
 return {root,window,doc,title,images,pending,observe,disconnect,mark};
}
afterEach(() => vi.useRealTimers());
it('reveals all critical images and title atomically, without a minimum delay or engine', async () => {
 const b = boot();
 b.pending.slice(1).forEach(p=>p.resolve()); await flush();
 expect(b.root.dataset.menuState).toBe('loading');
 expect(b.images.every(i=>i.classList.add.mock.calls.length===0)).toBe(true);
 b.pending[0].resolve(); await flush();
 expect(b.root.dataset.menuState).toBe('ready');
 expect(b.root.dataset.menuReason).toBe('decoded');
 expect(b.images.every(i=>i.classList.add.mock.calls[0][0]==='is-decoded')).toBe(true);
 expect(b.title.removeAttribute).toHaveBeenCalledWith('srcset');
 expect(b.title.src).toBe('responsive.webp');
 expect(b.doc.documentElement.dataset.titleFont).toBe('ready');
 expect(b.mark).toHaveBeenCalledWith('damka:menu-ready');
 expect(vi.getTimerCount()).toBe(0);
 expect(b.disconnect).toHaveBeenCalled();
});
it('failed critical decode commits fallback immediately; late images cannot upgrade it', async () => {
 const b = boot(); b.pending[1].reject(); await flush();
 expect(b.root.dataset.menuState).toBe('fallback');
 expect(b.root.dataset.menuReason).toBe('asset-error');
 b.pending.forEach(p=>p.resolve()); await flush();
 expect(b.root.dataset.menuState).toBe('fallback');
 expect(b.images.every(i=>i.classList.add.mock.calls.length===0)).toBe(true);
 expect(b.doc.documentElement.dataset.titleFont).toBe('fallback');
 expect(vi.getTimerCount()).toBe(0);
});
it('deadline is a maximum 2500ms, never a minimum wait; late art remains suppressed', async () => {
 const b = boot();
 vi.advanceTimersByTime(2499); expect(b.root.dataset.menuState).toBe('loading');
 vi.advanceTimersByTime(1); expect(b.root.dataset.menuState).toBe('fallback');
 expect(b.root.dataset.menuReason).toBe('deadline');
 b.pending.forEach(p=>p.resolve()); await flush();
 expect(b.mark).toHaveBeenCalledWith('damka:menu-fallback');
 expect(b.mark).not.toHaveBeenCalledWith('damka:menu-ready');
});
it.each(['hidden','departing','pagehide'])('cancels pending reveal and timer on %s', async mode => {
 const b = boot();
 if(mode==='hidden') b.root.hidden=true;
 if(mode==='departing') b.root.classList.add('is-departing');
 if(mode==='pagehide') b.window.dispatchEvent(new Event('pagehide')); else b.observe();
 b.pending.forEach(p=>p.resolve()); await flush(); vi.advanceTimersByTime(3000);
 expect(b.root.dataset.menuState).toBe('loading');
 expect(b.mark).not.toHaveBeenCalledWith('damka:menu-ready');
 expect(b.mark).not.toHaveBeenCalledWith('damka:menu-fallback');
 expect(vi.getTimerCount()).toBe(0);
 expect(b.disconnect).toHaveBeenCalled();
});
it('BFCache restoration uses a fixed fallback rather than a late abandoned reveal', async () => {
 const b = boot(); b.window.dispatchEvent(new Event('pagehide'));
 b.window.dispatchEvent(Object.assign(new Event('pageshow'),{persisted:true}));
 expect(b.root.dataset.menuReason).toBe('restored');
 b.pending.forEach(p=>p.resolve()); await flush();
 expect(b.root.dataset.menuState).toBe('fallback');
});
it('keeps the no-JS message and masks all loading descendants including selected badges', () => {
 expect(html).toContain('<noscript><p>Для игры нужен JavaScript.');
 expect(html).toContain(':not(.menu-loading):not(noscript) *{visibility:hidden!important}');
 expect(script).not.toMatch(/await.*(Phaser|fetch|audio|playfield)/);
});
