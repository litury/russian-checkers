import { afterEach, expect, it, vi } from 'vitest';
import { openLive } from './live';
import { ensureGuest } from './cloud';
vi.mock('./cloud', () => ({ ensureGuest: vi.fn() }));
vi.mock('./apiOrigin', () => ({ runtimeApiOrigin: () => 'http://local', wsUrl: () => 'ws://local/ws' }));
class Socket {
 static all: Socket[] = [];
 readyState = 1;
 onopen?: () => void;
 onerror?: () => void;
 onclose?: () => void;
 onmessage?: (event: {data: string}) => void;
 send = vi.fn();
 close = vi.fn(() => { this.readyState = 3; this.onclose?.(); });
 constructor() { Socket.all.push(this); }
 message(type: string) { this.onmessage?.({data: JSON.stringify({type, matchId:'r', pieces:[]})}); }
}
function setup() {
 vi.useFakeTimers(); Socket.all = []; vi.stubGlobal('WebSocket', Socket);
 vi.mocked(ensureGuest).mockResolvedValue({token:'test'} as Awaited<ReturnType<typeof ensureGuest>>);
 const onState = vi.fn();
 return {live: openLive({onState}), onState};
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
it('reconnects an active match and authenticates the replacement without replaying moves', async () => {
 const {live} = setup(); const first = live.connect(); await Promise.resolve();
 Socket.all[0].message('ok'); await first;
 Socket.all[0].onmessage?.({data: JSON.stringify({type:'start', color:'white',matchId:'r'})});
 Socket.all[0].close();
 await vi.advanceTimersByTimeAsync(1000);
 expect(Socket.all).toHaveLength(2);
 const next = Socket.all[1]; next.onopen?.();
 expect(next.send).toHaveBeenCalledWith(JSON.stringify({type:'auth',token:'test'}));
 next.message('ok'); await Promise.resolve();
 expect(live.isOpen()).toBe(true); live.close();
});

it('explicit close cancels a scheduled reconnect', async () => {
 const {live} = setup(); const first = live.connect(); await Promise.resolve();
 Socket.all[0].message('ok'); await first;
 Socket.all[0].onmessage?.({data: JSON.stringify({type:'start',color:'white',matchId:'r'})});
 Socket.all[0].close(); live.close(); await vi.runAllTimersAsync();
 expect(Socket.all).toHaveLength(1); expect(vi.getTimerCount()).toBe(0);
});

it('does not reconnect a queue-only session', async () => {
 const {live} = setup(); const first = live.connect(); await Promise.resolve();
 Socket.all[0].message('ok'); await first; live.queue(); Socket.all[0].close();
 await vi.runAllTimersAsync(); expect(Socket.all).toHaveLength(1);
});

it('close cancels an outstanding authentication attempt immediately', async () => {
 const {live} = setup();
 const pending = live.connect(); await Promise.resolve();
 const settled = vi.fn(); void pending.then(settled);
 live.close(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
 expect(settled).toHaveBeenCalledWith(false);
 expect(vi.getTimerCount()).toBe(0);
});
it('close while credentials load prevents a late socket from opening', async () => {
 const {live} = setup();
 let release!: (value: any) => void;
 vi.mocked(ensureGuest).mockImplementationOnce(() => new Promise(resolve => {release = resolve;}));
 const pending = live.connect(); live.close(); release({token:'test'});
 await Promise.resolve();
 expect(Socket.all).toHaveLength(0);
 expect(await pending).toBe(false);
});
it('replacement suppresses old messages and old open callbacks', async () => {
 const {live,onState} = setup();
 const first = live.connect(); await Promise.resolve(); const old = Socket.all[0];
 old.message('ok'); expect(await first).toBe(true);
 const second = live.connect(); await Promise.resolve(); const current = Socket.all[1];
 old.onopen?.(); old.message('state');
 expect(current.send).not.toHaveBeenCalled(); expect(onState).not.toHaveBeenCalled();
 current.onopen?.(); expect(current.send).toHaveBeenCalledOnce();
 current.message('ok'); expect(await second).toBe(true);
 current.message('state'); expect(onState).toHaveBeenCalledOnce(); live.close();
});
it('authentication timeout closes only its attempt and clears timers', async () => {
 const {live} = setup(); const pending = live.connect(); await Promise.resolve();
 await vi.runAllTimersAsync();
 expect(await pending).toBe(false); expect(live.isOpen()).toBe(false);
 expect(Socket.all[0].close).toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
});
it('replacement cancels pending auth without an old timeout closing the new socket', async () => {
 const {live} = setup(); const first = live.connect(); await Promise.resolve();
 const old = Socket.all[0];
 const second = live.connect(); await Promise.resolve(); const current = Socket.all[1];
 expect(await first).toBe(false);
 current.message('ok'); expect(await second).toBe(true);
 old.onerror?.(); old.onclose?.(); await vi.runAllTimersAsync();
 expect(live.isOpen()).toBe(true); expect(current.close).not.toHaveBeenCalled();
 live.close(); expect(live.isOpen()).toBe(false);
});

it('remote close during authentication settles false without timeout', async () => {
 const {live} = setup(); const pending = live.connect(); await Promise.resolve();
 const settled = vi.fn(); void pending.then(settled);
 Socket.all[0].close(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
 expect(settled).toHaveBeenCalledWith(false); expect(vi.getTimerCount()).toBe(0);
});
