import { afterEach, expect, it, vi } from 'vitest';
import { createStatsRecovery } from './openingStatsRecovery';

afterEach(() => vi.useRealTimers());
it('CS-02 paints pending before requesting and recovers after online without engine/reload', async () => {
 vi.useFakeTimers(); const load=vi.fn().mockResolvedValueOnce(null).mockResolvedValue({white:9,black:9,games:18});
 const paint=vi.fn(); const c=createStatsRecovery(load,paint);
 c.retry(); expect(paint).toHaveBeenCalledWith('loading',null);
 await vi.advanceTimersByTimeAsync(0);
 expect(paint).toHaveBeenLastCalledWith('error',null);
 c.retry(); await vi.advanceTimersByTimeAsync(2000);
 expect(load).toHaveBeenCalledTimes(2);
 expect(paint).toHaveBeenLastCalledWith('ready',{white:9,black:9,games:18});
 c.dispose();
});
it('coalesces online storms and bounds failed automatic retries to three', async () => {
 vi.useFakeTimers(); const load=vi.fn().mockResolvedValue(null); const c=createStatsRecovery(load,vi.fn());
 for(let i=0;i<100;i++) c.retry();
 await vi.advanceTimersByTimeAsync(60000);
 for(let i=0;i<100;i++) c.retry();
 await vi.advanceTimersByTimeAsync(60000);
 expect(load).toHaveBeenCalledTimes(3);
 c.retry(true); await vi.advanceTimersByTimeAsync(0); expect(load).toHaveBeenCalledTimes(4);
 c.dispose();
});
it('single flight, dispose and late completion cannot repaint', async () => {
 vi.useFakeTimers(); let resolve:any; const load=vi.fn(()=>new Promise<any>(r=>{resolve=r;})); const paint=vi.fn();
 const c=createStatsRecovery(load,paint); c.retry(); c.retry(true); c.retry(); expect(load).toHaveBeenCalledTimes(1);
 c.dispose(); resolve({white:0,black:0,games:0}); await vi.advanceTimersByTimeAsync(0);
 expect(paint).toHaveBeenCalledTimes(1);
});
it('manual retry is not dropped by the cooldown, and online after the cap recovers once', async () => {
 vi.useFakeTimers(); const load=vi.fn().mockResolvedValue(null);
 const c=createStatsRecovery(load,vi.fn());
 c.retry(); await vi.advanceTimersByTimeAsync(0);
 c.retry(true);
 await vi.advanceTimersByTimeAsync(1999); expect(load).toHaveBeenCalledTimes(1);
 await vi.advanceTimersByTimeAsync(1); expect(load).toHaveBeenCalledTimes(2);
 await vi.advanceTimersByTimeAsync(20000);
 const capped=load.mock.calls.length;
 expect(capped).toBe(4);
 c.noteOnline();
 await vi.advanceTimersByTimeAsync(10000);
 expect(load).toHaveBeenCalledTimes(capped+3);
 c.noteOnline();
 await vi.advanceTimersByTimeAsync(4000);
 expect(load).toHaveBeenCalledTimes(capped+3);
 c.dispose();
});
