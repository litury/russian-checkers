import {it,expect} from 'vitest';
import {MenuAudioPolicy,gateAudioPhase,menuMusicShouldPlay,menuMusicStopsInstantly,menuMusicFadeSec,matchMusicShouldPlay,matchMusicLevel} from './menuAudioPolicy';
import menuAudio from './menuAudio.ts?raw';
it('keeps independent pause reasons and saved mute authoritative',()=>{
 const p=new MenuAudioPolicy();expect(p.music).toBe(true);
 p.hidden=p.platform=true;p.platform=false;expect(p.audible).toBe(false);
 p.hidden=false;p.muted=true;expect(p.audible).toBe(false);
 p.muted=false;p.departing=true;expect(p.music).toBe(false);expect(p.audible).toBe(true);
 p.menu=false;expect(p.audible).toBe(false);
 p.match=true;expect(p.audible).toBe(true);expect(p.music).toBe(false);
});
it('keeps organ off during a match even if the music setting is on',()=>{
 const p=new MenuAudioPolicy();
 p.menu=false;p.match=true;
 expect(p.audible).toBe(true);
 expect(menuMusicShouldPlay(p,true,true)).toBe(false);
 expect(matchMusicShouldPlay(p,true,true)).toBe(true);
 expect(matchMusicLevel).toBeGreaterThanOrEqual(.15);
 expect(matchMusicLevel).toBeLessThanOrEqual(.25);
 expect(menuMusicStopsInstantly(p,true,true)).toBe(false);
 expect(menuMusicFadeSec).toBeGreaterThanOrEqual(.8);
 expect(menuMusicFadeSec).toBeLessThanOrEqual(1.5);
 p.menu=true;p.match=false;p.departing=false;
 expect(menuMusicShouldPlay(p,true,true)).toBe(true);
 p.muted=true;
 expect(menuMusicShouldPlay(p,true,true)).toBe(false);
 expect(menuMusicStopsInstantly(p,true,true)).toBe(true);
});
it('fades menu music on depart, and does not hard-stop at match start',()=>{
 expect(menuAudio).toContain('linearRampToValueAtTime(0');
 expect(menuAudio).not.toMatch(/beginMatch\(\)\{[^}]*stopMusic\(\)/);
 expect(menuAudio).not.toContain('policy.departing?.12');
});
it('maps mechanism cues to actual gate phases',()=>{
 expect([0,400,1159,1160,1999,2000].map(gateAudioPhase)).toEqual(['press','unlock','unlock','motion','motion','stop']);
});
