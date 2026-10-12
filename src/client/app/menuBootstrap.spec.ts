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
 const mark = vi.fn(), timers: Array<{fn:()=>void;ms:number}> = [];
 new Function('document','window','requestAnimationFrame','performance','loadEngine','setTimeout',source)(
  {getElementById:()=>menu},{checkersStartup:startup},(fn:()=>void)=>frames.push(fn),{mark,now:()=>500},loadEngine,(fn:()=>void,ms:number)=>timers.push({fn,ms}));
 return {menu,startup,frames,mark,loadEngine,timers,runTimer:()=>timers.shift()?.fn(),step:()=>frames.shift()?.(),resolve:()=>resolve(),reject:()=>reject()};
}
it('starts independently of image/font loading, reserving the first 2s for menu', async () => {
 const b = boot();
 expect(b.frames).toHaveLength(1); expect(b.loadEngine).not.toHaveBeenCalled();
 b.step(); // pre-paint callback must yield once, including a warm module cache
 expect(b.loadEngine).not.toHaveBeenCalled();
 expect(b.startup.presented).not.toHaveBeenCalled();
 b.step();
 expect(b.startup.presented).toHaveBeenCalledOnce();
 expect(b.loadEngine).not.toHaveBeenCalled();
 expect(b.timers[0].ms).toBe(1500);
 b.runTimer();
 expect(b.loadEngine).toHaveBeenCalledOnce();
 expect(b.startup.engineReady).not.toHaveBeenCalled();
 b.resolve(); await Promise.resolve();
 expect(b.startup.engineReady).toHaveBeenCalledOnce();
 expect(b.mark).toHaveBeenCalledWith('damka:menu-presented');
 expect(b.mark).toHaveBeenCalledWith('damka:engine-ready');
 b.menu.dispatchEvent(new Event('menu-settled'));
 expect(b.frames).toHaveLength(0);
});
it('a module still yields a paint and reports import failure honestly', async () => {
 const b=boot('ready'); b.step(); b.step(); b.runTimer(); b.reject();
 await Promise.resolve(); await Promise.resolve();
 expect(b.startup.engineReady).not.toHaveBeenCalled();
 expect(b.startup.fail).toHaveBeenCalledWith('Не удалось запустить игру. Проверьте соединение и повторите загрузку.');
});
