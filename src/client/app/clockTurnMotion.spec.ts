import { expect, it } from 'vitest';
import { clockFramePose, clockFrameStep } from './clockFrame';

it('closes four rigid quarters from outside the digit aperture, then holds still', () => {
 const entering = clockFramePose(0.35, true, false);
 expect(entering.spreadX).toBeGreaterThan(0);
 expect(entering.spreadY).toBeGreaterThan(0);
 expect(entering.amber).toBe(0);
 const held = clockFramePose(1, true, false);
 expect(held).toEqual({spreadX:0, spreadY:0, metal:1, amber:1, lights:0.8});
 for(let i=0;i<100;i++) expect(clockFramePose(clockFrameStep(1,true,16,false),true,false)).toEqual(held);
});
it('extinguishes outgoing amber immediately while its metal retracts', () => {
 const out = clockFramePose(0.85, false, false);
 expect(out.amber).toBe(0); expect(out.lights).toBe(0);
 expect(out.metal).toBeGreaterThan(0);
 expect(out.spreadX).toBeGreaterThan(0);
 expect(clockFramePose(0,false,false).metal).toBe(0);
});
it('reduced motion always uses the correct static endpoint, even before update', () => {
 expect(clockFramePose(0.2,true,true)).toEqual({spreadX:0,spreadY:0,metal:0,amber:1,lights:0});
 expect(clockFramePose(0.8,false,true)).toEqual({spreadX:0,spreadY:0,metal:0,amber:0,lights:0});
});
it('reverses from current progress and clamps a long frame and negative dt', () => {
 const v=clockFrameStep(0.6,false,32,false);
 expect(v).toBeLessThan(0.6); expect(clockFrameStep(v,true,42,false)).toBeCloseTo(0.6);
 expect(clockFrameStep(v,true,5000,false)).toBe(1);
 expect(clockFrameStep(v,false,5000,false)).toBe(0);
 expect(clockFrameStep(v,true,-20,false)).toBe(v);
});
