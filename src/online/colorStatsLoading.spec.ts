import { afterEach, expect, it, vi } from 'vitest';
import { loadColorStats } from './cloud';

afterEach(() => vi.unstubAllGlobals());
it.each([{white:null,black:0,games:0},{white:'',black:0,games:0},{white:-1,black:0,games:0},{white:1.5,black:0,games:2}])('rejects absent/invalid counters rather than inventing zero: %j', async body => {
 vi.stubGlobal('fetch', vi.fn(async()=>new Response(JSON.stringify(body))));
 expect(await loadColorStats()).toBeNull();
});
it('accepts real zero', async () => {
 vi.stubGlobal('fetch', vi.fn(async()=>new Response(JSON.stringify({white:0,black:0,games:0}))));
 expect(await loadColorStats()).toEqual({white:0,black:0,games:0});
});
