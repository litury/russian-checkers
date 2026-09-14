import {it,expect} from 'vitest';
import {MenuAudioPolicy,gateAudioPhase} from './menuAudioPolicy';
it('keeps independent pause reasons and saved mute authoritative',()=>{
 const p=new MenuAudioPolicy();expect(p.music).toBe(true);
 p.hidden=p.platform=true;p.platform=false;expect(p.audible).toBe(false);
 p.hidden=false;p.muted=true;expect(p.audible).toBe(false);
 p.muted=false;p.departing=true;expect(p.music).toBe(false);expect(p.audible).toBe(true);
 p.menu=false;expect(p.audible).toBe(false);
});
it('maps mechanism cues to actual gate phases',()=>{
 expect([0,400,1159,1160,1999,2000].map(gateAudioPhase)).toEqual(['press','unlock','unlock','motion','motion','stop']);
});
