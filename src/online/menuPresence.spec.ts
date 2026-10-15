import {afterEach, expect, it, vi} from 'vitest';
import {beatPresence, ensureGuest, loadPresence} from './cloud';
afterEach(()=>vi.unstubAllGlobals());
it('shares the guest request between concurrent menu consumers',async()=>{
 const values=new Map<string,string>();
 vi.stubGlobal('localStorage',{getItem:(k:string)=>values.get(k),setItem:(k:string,v:string)=>values.set(k,v)});
 let finish!: (response: Response) => void;
 const fetch=vi.fn(()=>new Promise<Response>(resolve=>{finish=resolve;}));vi.stubGlobal('fetch',fetch);
 const one=ensureGuest(), two=ensureGuest();
 expect(fetch).toHaveBeenCalledTimes(1);
 finish(new Response(JSON.stringify({id:'test-player',token:'test-token'})));
 expect(await one).toEqual(await two);
 expect(await ensureGuest()).toEqual({id:'test-player',token:'test-token'});
 expect(fetch).toHaveBeenCalledTimes(1);
});
it.each([null,undefined,'0',-1,0.5,{},false])('rejects invalid presence %j instead of showing a fake zero',async live=>{
 vi.stubGlobal('localStorage',{getItem:(k:string)=>k.endsWith('Token')?'test-token':'test-player'});
 vi.stubGlobal('sessionStorage',{getItem:()=> 'test-tab'});
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({live}))));
 expect(await loadPresence()).toBe(null);expect(await beatPresence()).toBe(null);
});
it('accepts a confirmed zero',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response('{"live":0}')));
 expect(await loadPresence()).toBe(0);
});
