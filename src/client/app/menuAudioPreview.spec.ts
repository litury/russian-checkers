import {it,expect} from 'vitest';
import {previewLoop,mechanismEnvelope} from './menuAudioPreview';
it('crossfades a technical loop without changing interior sample spacing',()=>{
 const x=Float32Array.from([0,1,2,3,4,5,6,7]);const y=previewLoop(x,3);
 expect(y.length).toBe(5);expect([...y.slice(0,2)]).toEqual([3,4]);expect(y.at(-1)).toBe(2);
});
it('fades motion out at its real end',()=>{
 expect(mechanismEnvelope(1160,1160,2000)).toBe(0);
 expect(mechanismEnvelope(1500,1160,2000)).toBe(1);
 expect(mechanismEnvelope(1960,1160,2000)).toBeLessThan(.5);
 expect(mechanismEnvelope(2000,1160,2000)).toBe(0);
});
