import {afterEach, expect,it,vi} from 'vitest';
import {assetCache,loadImage,loadBytes} from './assetLoader';
import {boardDelivery} from './boardDelivery';
afterEach(()=>vi.unstubAllGlobals());
it('shares the exact in-flight and settled promise for all callers of one URL',async()=>{
 let done!:(value:number)=>void;
 const loader=vi.fn(()=>new Promise<number>(resolve=>done=resolve)),get=assetCache(loader);
 const a=get('/same'),b=get('/same');expect(a).toBe(b);
 await Promise.resolve();expect(loader).toHaveBeenCalledTimes(1);
 done(42);expect(await a).toBe(42);expect(get('/same')).toBe(a);
});
it('evicts failures for explicit retry, but never starts a retry itself',async()=>{
 const loader=vi.fn().mockRejectedValueOnce(Error('offline')).mockResolvedValue(9),get=assetCache(loader);
 await expect(get('/retry')).rejects.toThrow('offline');expect(loader).toHaveBeenCalledTimes(1);
 expect(await get('/retry')).toBe(9);expect(loader).toHaveBeenCalledTimes(2);
});
it('reuses the DOM critical image without creating another image or XHR',async()=>{
 const image={src:'https://game.test/critical.webp',currentSrc:'https://game.test/critical.webp',decode:vi.fn(async()=>{})};
 vi.stubGlobal('document',{querySelectorAll:()=>[image]});const create=vi.fn();vi.stubGlobal('Image',create);
 const first=loadImage(image.src),second=loadImage(image.src);expect(first).toBe(second);
 expect(await first).toBe(image);expect(create).not.toHaveBeenCalled();expect(image.decode).toHaveBeenCalledTimes(1);
});
it('shares bytes for audio aliases, retaining the source buffer for repeated decodes',async()=>{
 const data=new ArrayBuffer(8),fetch=vi.fn(async()=>({ok:true,arrayBuffer:async()=>data}));vi.stubGlobal('fetch',fetch);
 const [a,b]=await Promise.all([loadBytes('/voice'),loadBytes('/voice')]);expect(a).toBe(b);expect(fetch).toHaveBeenCalledTimes(1);expect(a.slice(0)).not.toBe(a);
});
it.each([[390,1,'760','128'],[390,3,'1520','256'],[1440,1,'1520','128']])('chooses native density assets at width %s DPR %s',(width,dpr,board,piece)=>{
 vi.stubGlobal('window',{innerWidth:width,devicePixelRatio:dpr});
 expect(boardDelivery('board-frames','fallback')).toContain(`board-frames-${board}`);
 expect(boardDelivery('black_disk','fallback')).toContain(`black_disk-${piece}`);
 expect(boardDelivery('slate_tile','fallback')).toBe('fallback');
});
