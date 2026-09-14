import {expect,it} from 'vitest';
import {gatePose,OpeningGates} from './openingGates';
import {preparationMs} from './panelReveal';
it('unlocks bars before title retracts and doors open',()=>{
 expect(gatePose(0)).toEqual({press:0,slide:0,title:0,doors:0});
 expect(gatePose(preparationMs*.48)).toMatchObject({slide:1,title:0,doors:0});
 expect(gatePose(preparationMs)).toEqual({press:1,slide:1,title:1,doors:1});
});
it('freezes on pause, cancels stale completions, and finishes only once',()=>{
 const gates=new OpeningGates();let old=0,ready=0;
 gates.start(()=>old++);gates.advance(700);gates.advance(5000,true);expect(gates.elapsed).toBe(700);
 gates.cancel();gates.advance(5000);expect(old).toBe(0);
 gates.start(()=>ready++);gates.advance(preparationMs);gates.advance(preparationMs);expect(ready).toBe(1);
});
