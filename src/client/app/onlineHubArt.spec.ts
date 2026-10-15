import {afterEach, expect, it, vi} from 'vitest';
const images: Array<{onload: () => void; onerror: () => void; decode: ReturnType<typeof vi.fn>}> = [];
async function setup() {
 vi.resetModules(); vi.useFakeTimers(); images.length = 0;
 vi.stubGlobal('window', {setTimeout, clearTimeout});
 vi.stubGlobal('document', {fonts:{load:vi.fn(async () => [])}});
 vi.stubGlobal('Image', class {
  onload = () => {}; onerror = () => {}; src = '';
  decode = vi.fn(async () => {});
  constructor() { images.push(this); }
 });
 return import('./onlineHubArt');
}
afterEach(() => {vi.useRealTimers();vi.unstubAllGlobals();});
it('shares one critical decode batch and reuses successful readiness', async () => {
 const art = await setup();
 const first = art.prepareOnlineHubArt();
 expect(art.prepareOnlineHubArt()).toBe(first);
 expect(images).toHaveLength(6);
 images.forEach(image => image.onload());
 expect(await first).toBe(true);
 expect(images.every(image => image.decode.mock.calls.length === 1)).toBe(true);
 expect(await art.prepareOnlineHubArt()).toBe(true);
 expect(images).toHaveLength(6);
});
it('times out without permanent concealment and retries a failed batch', async () => {
 const art = await setup(); const first = art.prepareOnlineHubArt();
 await vi.advanceTimersByTimeAsync(3000);
 expect(await first).toBe(false);
 const retry = art.prepareOnlineHubArt();
 expect(images).toHaveLength(12);
 images.slice(6).forEach(image => image.onload());
 expect(await retry).toBe(true);
});
it('does not accept download completion before decoding', async () => {
 const art = await setup();
 let decode!: () => void;
 const first = art.prepareOnlineHubArt();
 images[0].decode.mockImplementation(() => new Promise<void>(resolve => {decode = resolve;}));
 images.forEach(image => image.onload());
 let done = false; void first.then(() => {done = true;});
 await Promise.resolve();expect(done).toBe(false);
 decode();expect(await first).toBe(true);
});
it('cancels idle warmup on shutdown', async () => {
 const art = await setup(); const cancel = art.warmOnlineHubArt(); cancel();
 await vi.advanceTimersByTimeAsync(500);
 expect(images).toHaveLength(0);
});
