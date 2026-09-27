import { expect, it, vi } from 'vitest';
import html from '../../../index.html?raw';

// Execute the real bootstrap, substituting only the network import boundary.
const source = html.match(/<script type="module" id="opening-engine-bootstrap">([\s\S]*?)<\/script>/)![1]
 .replace("import('/src/client/app/main.ts')", 'loadEngine()');
function boot(state = 'loading') {
 const menu = Object.assign(new EventTarget(), {dataset:{menuState:state}});
 const startup = {presented:vi.fn(),engineReady:vi.fn(),fail:vi.fn()};
 let resolve!: () => void, reject!: () => void;
 const loadEngine = vi.fn(() => new Promise<void>((ok,no) => {resolve=ok;reject=()=>no(new Error('offline'));}));
 const frames: Array<() => void> = [];
 const mark = vi.fn();
 new Function('document','window','requestAnimationFrame','performance','loadEngine',source)(
  {getElementById:()=>menu},{checkersStartup:startup},(fn:()=>void)=>frames.push(fn),{mark},loadEngine);
 return {menu,startup,frames,mark,loadEngine,step:()=>frames.shift()?.(),resolve:()=>resolve(),reject:()=>reject()};
}
it.each(['ready','fallback'])('presents a complete %s frame before engine evaluation; no minimum timed wait', async state => {
 const b = boot();
 expect(b.frames).toHaveLength(0); expect(b.loadEngine).not.toHaveBeenCalled();
 b.menu.dataset.menuState=state;
 b.menu.dispatchEvent(new Event('menu-settled'));
 b.step(); // pre-paint callback must yield once, including a warm module cache
 expect(b.loadEngine).not.toHaveBeenCalled();
 expect(b.startup.presented).not.toHaveBeenCalled();
 b.step();
 expect(b.startup.presented).toHaveBeenCalledOnce();
 expect(b.loadEngine).toHaveBeenCalledOnce();
 expect(b.startup.engineReady).not.toHaveBeenCalled();
 b.resolve(); await Promise.resolve();
 expect(b.startup.engineReady).toHaveBeenCalledOnce();
 expect(b.mark).toHaveBeenCalledWith('damka:menu-presented');
 expect(b.mark).toHaveBeenCalledWith('damka:engine-ready');
 b.menu.dispatchEvent(new Event('menu-settled'));
 expect(b.frames).toHaveLength(0);
});
it('a module arriving after menu settlement still yields a paint and reports import failure honestly', async () => {
 const b=boot('ready'); b.step(); b.step(); b.reject();
 await Promise.resolve(); await Promise.resolve();
 expect(b.startup.engineReady).not.toHaveBeenCalled();
 expect(b.startup.fail).toHaveBeenCalledWith('Не удалось запустить игру. Проверьте соединение и повторите загрузку.');
});
