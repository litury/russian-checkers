import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {createMenuAudio} from './menuAudio';
import type {IYandexSdk} from './IYandexSdk';
import {menuMusicCompensation,matchMusicCompensation} from './musicDelivery';
import {menuOrganLevel,matchMusicLevel} from './audioMix';
import {matchMusicDuck} from './audioMix';
import {uiSfx} from './uiSfx';
import {pieceStepSfx,pieceCaptureSfx,cancelPieceAh} from './pieceSfx';
import {kingFireIgniteSfx} from './kingFireSfx';
// Each test is a fresh page; transport de-duplication has its own runtime tests.
vi.mock('./assetLoader', () => ({loadBytes: async (url:string) => {
 const response=await fetch(url,{priority:'low'});
 if(!response.ok)throw Error('audio unavailable');
 return response.arrayBuffer();
}}));

const deferred = <T>() => {
 let resolve!: (value:T)=>void, reject!: (reason?:unknown)=>void;
 const promise=new Promise<T>((yes,no)=>{resolve=yes;reject=no;});
 return {promise,resolve,reject};
};
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
let handlers:Map<string,EventListener>, settings:{muted:boolean,master:number,music:number,effects:number};
let hidden:boolean, pause:()=>void, resume:()=>void, now:number;
let requests:Map<string,ReturnType<typeof deferred<Response>>>;
let activation:ReturnType<typeof deferred<void>>;
let starts:string[], stops:string[], context:FakeContext, audio:ReturnType<typeof createMenuAudio>;
class FakeContext {
 state='suspended'; currentTime=0; destination={};
 constructor(){context=this;}
 resume=vi.fn(()=>activation.promise.then(()=>{this.state='running';}));
 close=vi.fn(async()=>{this.state='closed';});
 decodeAudioData=vi.fn(async(data:unknown)=>data);
 createBuffer=vi.fn(()=>({name:'menu_music_source',copyToChannel(){}}));
 createGain=vi.fn(()=>({gain:{value:0,cancelScheduledValues:vi.fn(),setValueAtTime(){},linearRampToValueAtTime(){},setTargetAtTime(value:number){this.value=value;}},connect(){return this;},disconnect(){}}));
 createBufferSource=vi.fn(()=>({buffer:null as unknown,loop:false,onended:null,connect:(node:unknown)=>node,disconnect(){},stop(){stops.push((this.buffer as {name:string}).name);},start(){starts.push((this.buffer as {name:string}).name);}}));
}
function fire(type:string,id='opening-play',trusted=true){
 handlers.get(type)?.({isTrusted:trusted,target:{closest:(selector:string)=>selector.split(',').includes(`#${id}`)}} as unknown as Event);
}
async function load(name:string){
 // A warm buffer now requires a previous real activation. Cold-click tests
 // already activated before calling this helper, and keep their first gesture.
 if(['menu_music_source','result-ascension','result-disposal'].includes(name))audio.warmAudio();
 if(!requests.size){fire('pointerdown','elsewhere');context.resume.mockClear();}
 await flush();
 const entry=[...requests].find(([url])=>url.includes(`/${name}.`));
 expect(entry,`asset ${name}`).toBeDefined();
 entry![1].resolve({ok:true,arrayBuffer:async()=>({slice(){return this;},name,sampleRate:2,length:8,numberOfChannels:1,getChannelData:()=>new Float32Array(8)})} as unknown as Response);
 await flush();
}
beforeEach(()=>{
 handlers=new Map();requests=new Map();starts=[];stops=[];hidden=false;now=0;
 settings={muted:false,master:1,music:0,effects:1};activation=deferred<void>();
 vi.stubGlobal('performance',{now:()=>now});
 const events={addEventListener:(type:string,fn:EventListener)=>handlers.set(type,fn),removeEventListener:(type:string)=>handlers.delete(type)};
 vi.stubGlobal('document',{...events,get hidden(){return hidden;},getElementById:()=>({addEventListener(){}})});
 vi.stubGlobal('window',{...events,checkersSettings:{get:()=>settings},setTimeout});
 vi.stubGlobal('AudioContext',FakeContext);
 vi.stubGlobal('fetch',vi.fn((url:string)=>{const request=deferred<Response>();requests.set(url,request);return request.promise;}));
 audio=createMenuAudio({onPause:(fn:()=>void)=>{pause=fn;},onResume:(fn:()=>void)=>{resume=fn;}} as unknown as IYandexSdk);
});
afterEach(()=>{audio.dispose();vi.unstubAllGlobals();});

it('defers menu music and result ceremony until playfield readiness, once',async()=>{
 const has=(name:string)=>[...requests.keys()].some(url=>url.includes(`/${name}.`));
 settings.music=1;
 audio.warmAudio();
 expect(requests.size).toBe(0);
 fire('pointerdown','elsewhere');await flush();
 expect(has('ui_click')).toBe(true);
 expect(has('play-b')).toBe(true);
 expect(has('match-b-90s')).toBe(false);
 for(const name of ['menu_music_source','result-ascension','result-disposal'])expect(has(name),name).toBe(true);
 const size=requests.size;
 audio.warmAudio();
 expect(requests.size).toBe(size);
});

it('keeps menu theme and result ceremony off the pre-board gesture',async()=>{
 const has=(name:string)=>[...requests.keys()].some(url=>url.includes(`/${name}.`));
 settings.music=1;
 fire('pointerdown','elsewhere');await flush();
 expect(has('ui_click')).toBe(true);
 for(const name of ['menu_music_source','result-ascension','result-disposal'])expect(has(name),name).toBe(false);
 audio.warmAudio();
 for(const name of ['menu_music_source','result-ascension','result-disposal'])expect(has(name),name).toBe(true);
 const size=requests.size;
 audio.warmAudio();
 expect(requests.size).toBe(size);
});

it('does not download the menu theme while leaving, even after the board gate',()=>{
 const has=(name:string)=>[...requests.keys()].some(url=>url.includes(`/${name}.`));
 settings.music=1;
 fire('pointerdown','opening-play');
 audio.warmAudio();
 expect(has('menu_music_source')).toBe(false);
 expect(has('result-ascension')).toBe(true);
 expect(has('result-disposal')).toBe(true);
});

it('does not fetch deferred audio after disposal',()=>{
 fire('pointerdown','elsewhere');
 audio.dispose();const size=requests.size;
 audio.warmAudio();expect(requests.size).toBe(size);
});

it.each(['pendingPlay','playCommitted'])('does not warm an inactive menu theme while %s survives late show/readiness',async(flag)=>{
 settings.music=1;
 (window as unknown as {checkersStartup:Record<string,boolean>}).checkersStartup={[flag]:true};
 fire('pointerdown','opening-play');activation.resolve();await flush();
 audio.show();audio.warmAudio();await flush();
 expect([...requests.keys()].some(url=>url.includes('/menu_music_source.'))).toBe(false);
 (window as unknown as {checkersStartup:Record<string,boolean>}).checkersStartup={[flag]:false};
 audio.show();await flush();
 expect([...requests.keys()].some(url=>url.includes('/menu_music_source.'))).toBe(true);
});

it('remembers readiness when AudioContext creation initially fails',()=>{
 audio.dispose();requests.clear();
 vi.stubGlobal('AudioContext',class {constructor(){throw Error('unavailable');}});
 audio=createMenuAudio({onPause(){},onResume(){}} as unknown as IYandexSdk);
 audio.warmAudio();expect(requests.size).toBe(0);
 vi.stubGlobal('AudioContext',FakeContext);
 settings.music=1;
 fire('pointerdown','elsewhere');
 expect([...requests.keys()].some(url=>url.includes('/menu_music_source.'))).toBe(true);
 expect([...requests.keys()].some(url=>url.includes('/result-ascension.'))).toBe(true);
});

it('does not request any audio on creation, synthetic gestures, or passive menu updates',async()=>{
 fire('pointerdown','elsewhere',false);fire('click','opening-play',false);
 audio.show();fire('checkers-settings-change');await flush();
 expect(requests.size).toBe(0);expect(context.resume).not.toHaveBeenCalled();
 fire('pointerdown','elsewhere');await flush();expect(requests.size).toBeGreaterThan(0);
 const count=requests.size;fire('pointerdown','elsewhere');await flush();expect(requests.size).toBe(count);
});

it.each(['mute','hidden','pause'])('stops active menu music immediately on %s',async(reason)=>{
 settings.music=1;await load('menu_music_source');
 activation.resolve();fire('pointerdown','elsewhere');await flush();
 expect(starts).toEqual(['menu_music_source']);
 if(reason==='mute'){settings.muted=true;fire('checkers-settings-change');}
 if(reason==='hidden'){hidden=true;fire('visibilitychange');}
 if(reason==='pause')pause();
 expect(stops).toEqual(['menu_music_source']);
});

it('plays one ceremony layer without the retired result sting',async()=>{
 for(const name of ['result-ascension','result-disposal','win','lose','victory'])await load(name);
 activation.resolve();fire('pointerdown','elsewhere');await flush();audio.beginMatch();
 audio.resultSting(true,'victory','black');audio.resultCeremonySound(true);
 expect(starts).toEqual(['victory','result-ascension']);
 audio.stopResultCeremonySound();expect(stops).toContain('result-ascension');
});
it.each(['mute','hidden','pause','show','dispose'])('cancels active ceremony on %s, without replay',async(reason)=>{
 await load('result-disposal');activation.resolve();fire('pointerdown','elsewhere');await flush();audio.beginMatch();
 audio.resultCeremonySound(false);expect(starts).toEqual(['result-disposal']);
 if(reason==='mute'){settings.muted=true;fire('checkers-settings-change');settings.muted=false;fire('checkers-settings-change');}
 if(reason==='hidden'){hidden=true;fire('visibilitychange');hidden=false;fire('visibilitychange');}
 if(reason==='pause'){pause();resume();}
 if(reason==='show')audio.show();if(reason==='dispose')audio.dispose();
 expect(stops).toContain('result-disposal');expect(starts).toEqual(['result-disposal']);
});
it('never queues a cold or muted ceremony',async()=>{
 activation.resolve();fire('pointerdown','elsewhere');await flush();audio.beginMatch();
 audio.resultCeremonySound(true);await load('result-ascension');expect(starts).toEqual([]);
 settings.muted=true;audio.resultCeremonySound(true);expect(starts).toEqual([]);
});
it('replaces an active ceremony without concurrent duplicates',async()=>{
 await load('result-ascension');await load('result-disposal');activation.resolve();fire('pointerdown','elsewhere');await flush();audio.beginMatch();
 audio.resultCeremonySound(true);audio.resultCeremonySound(false);
 expect(stops).toEqual(['result-ascension']);expect(starts).toEqual(['result-ascension','result-disposal']);
});

it('resumes within trusted sound enabling click, but never clears mute itself',async()=>{
 settings.muted=true;
 fire('click','settings-muted');
 expect(context.resume).toHaveBeenCalledTimes(1);
 expect(settings.muted).toBe(true);
});
it('does not unlock on sound-disable pointerdown or synthetic enable',()=>{
 fire('pointerdown','settings-muted');
 fire('click','settings-muted',false);
 expect(context.resume).not.toHaveBeenCalled();
});
it('resumes on muted sound pointerdown so unmute can start sources',async()=>{
 settings.muted=true;settings.music=1;await load('menu_music_source');
 fire('pointerdown','settings-muted');
 expect(context.resume).toHaveBeenCalledTimes(1);
 settings.muted=false;fire('checkers-settings-change');
 activation.resolve();await flush();
 expect(starts).toEqual(['menu_music_source']);
});
it('starts menu music after trusted unmute click once the context is running',async()=>{
 settings.muted=true;settings.music=1;await load('menu_music_source');
 fire('click','settings-muted');
 settings.muted=false;fire('checkers-settings-change');
 expect(starts).toEqual([]);
 activation.resolve();await flush();
 expect(starts).toEqual(['menu_music_source']);
});
it('plays a quiet contact once after trusted down, with no selection click duplicate',async()=>{
 await load('menu-contact');activation.resolve();
 audio.menuContact({isTrusted:true} as Event,()=>true);await flush();
 fire('click','gate-piece');await flush();
 expect(starts).toEqual(['menu-contact']);
});
it.each(['mute','hidden','pause','cancel','depart','synthetic'])('does not leak contact on %s',async(reason)=>{
 await load('menu-contact');
 if(reason==='mute')settings.muted=true;
 if(reason==='hidden')hidden=true;
 if(reason==='pause')pause();
 audio.menuContact({isTrusted:reason!=='synthetic'} as Event,()=>reason!=='cancel');
 if(reason==='depart')audio.depart();
 activation.resolve();await flush();expect(starts).toEqual([]);
});
it('starts play-b on first Play against a still-suspended AudioContext',async()=>{
 await load('play-b');
 expect(context.state).toBe('suspended');
 fire('pointerdown');fire('click');
 expect(starts).toEqual([]);
 activation.resolve();await flush();
 expect(context.state).toBe('running');
 expect(starts).toEqual(['play-b']);
});
it('ordinary gestures preserve explicit mute',async()=>{
 settings.muted=true;await load('play-b');activation.resolve();
 fire('pointerdown');fire('click');await flush();
 expect(settings.muted).toBe(true);expect(starts).toEqual([]);
});

it('plays the first warm Play once resume finishes, without blocking depart',async()=>{
 await load('play-b');fire('pointerdown');fire('click');audio.depart();
 expect(starts).toEqual([]);
 activation.resolve();await flush();
 expect(starts).toEqual(['play-b']);
});
it('plays the first cold Play when only its buffer becomes ready',async()=>{
 activation.resolve();fire('pointerdown');await flush();fire('click');audio.depart();
 expect(starts).toEqual([]);await load('play-b');
 expect(starts).toEqual(['play-b']);
});
it.each(['mute','effects','master','hidden','pause','hide','show','beginMatch','dispose','new-click','expired'])('cancels pending Play after %s, even if restored before readiness',async(reason)=>{
 fire('pointerdown');fire('click');
 switch(reason){
  case 'mute': settings.muted=true;fire('checkers-settings-change');settings.muted=false;fire('checkers-settings-change');break;
  case 'effects': settings.effects=0;fire('checkers-settings-change');settings.effects=1;fire('checkers-settings-change');break;
  case 'master': settings.master=0;fire('checkers-settings-change');settings.master=1;fire('checkers-settings-change');break;
  case 'hidden': hidden=true;fire('visibilitychange');hidden=false;fire('visibilitychange');break;
  case 'pause': pause();resume();break;
  case 'hide': audio.hide();break;
  case 'show': audio.show();break;
  case 'beginMatch': audio.beginMatch();break;
  case 'dispose': audio.dispose();break;
  case 'new-click': fire('click','elsewhere');break;
  case 'expired': now=351;break;
 }
 activation.resolve();await load('play-b');
 expect(starts).toEqual([]);
});
it.each(['mute','effects','master','hidden','pause'])('does not queue a click initially suppressed by %s',async(reason)=>{
 if(reason==='mute')settings.muted=true;
 if(reason==='effects')settings.effects=0;
 if(reason==='master')settings.master=0;
 if(reason==='hidden')hidden=true;
 if(reason==='pause')pause();
 fire('click');settings.muted=false;settings.effects=1;settings.master=1;hidden=false;resume();
 activation.resolve();await load('play-b');expect(starts).toEqual([]);
});
it('ignores synthetic activation and never resumes during prepare',async()=>{
 await load('play-b');fire('pointerdown','opening-play',false);fire('click','opening-play',false);
 expect(context.resume).not.toHaveBeenCalled();expect(starts).toEqual([]);
});
it('supports trusted click-only activation exactly once',async()=>{
 await load('play-b');fire('click');expect(context.resume).toHaveBeenCalledTimes(1);
 activation.resolve();await flush();expect(starts).toEqual(['play-b']);
});
it('supports keyboard activation',async()=>{
 await load('play-b');fire('keydown');fire('click');audio.depart();
 activation.resolve();await flush();expect(starts).toEqual(['play-b']);
});
it('keeps the warm running click synchronous',async()=>{
 await load('play-b');activation.resolve();fire('pointerdown');await flush();fire('click');
 expect(starts).toEqual(['play-b']);
});
it('does not replay a superseded help click after Play',async()=>{
 fire('pointerdown','opening-help');fire('click','opening-help');fire('pointerdown');fire('click');audio.depart();
 activation.resolve();await load('ui_click');await load('play-b');expect(starts).toEqual(['play-b']);
});
it.each(['opening-help','opening-settings'])('keeps cold %s feedback working',async(id)=>{
 fire('pointerdown',id);fire('click',id);activation.resolve();await load('ui_click');
 expect(starts).toEqual(['ui_click']);
});
it.each([['opening-play','play-b'],['opening-help','ui_click'],['opening-settings','ui_click'],['opening-options','ui-open']])('emits exactly the assigned warm cue for %s',async(id,cue)=>{
 for(const name of ['play-b','ui_click','ui-open'])await load(name);
 activation.resolve();fire('pointerdown',id);await flush();fire('click',id);await flush();
 expect(starts).toEqual([cue]);
});
it('does not revive pending feedback after disposal from a match',async()=>{
 fire('click');audio.beginMatch();audio.dispose();activation.resolve();await load('play-b');
 expect(starts).toEqual([]);
});
it('drops rejected resume without retrying later',async()=>{
 fire('pointerdown');fire('click');activation.reject(Error('blocked'));await load('play-b');
 expect(starts).toEqual([]);
});
it('turn handoff never unlocks audio and uses one short cue per explicit event', async()=>{
 audio.turnHandoff(); expect(context.resume).not.toHaveBeenCalled(); expect(starts).toEqual([]);
 await load('turn-handoff'); activation.resolve(); fire('pointerdown','elsewhere'); await flush();
 audio.beginMatch(); audio.turnHandoff();
 expect(starts).toEqual(['turn-handoff']);
 await flush(); fire('checkers-settings-change');
 expect(starts).toEqual(['turn-handoff']);
});
it.each(['mute','hidden','pause','effects','master'])('drops handoff under %s without deferred replay',async(reason)=>{
 await load('turn-handoff'); activation.resolve(); fire('pointerdown','elsewhere'); await flush(); audio.beginMatch();
 if(reason==='mute')settings.muted=true;
 if(reason==='hidden')hidden=true;
 if(reason==='pause')pause();
 if(reason==='effects')settings.effects=0;
 if(reason==='master')settings.master=0;
 audio.turnHandoff(); expect(starts).toEqual([]);
 settings.muted=false;hidden=false;settings.effects=1;settings.master=1;resume();fire('checkers-settings-change');await flush();
 expect(starts).toEqual([]);
 audio.turnHandoff(); expect(starts).toEqual(['turn-handoff']);
});

it('drops failed Play fetch without blocking or playing other assets',async()=>{
 fire('click');activation.resolve();
 [...requests].find(([url])=>url.includes('/play-b.'))![1].reject(Error('offline'));
 await flush();expect(starts).toEqual([]);
});

it('preserves baked decoded music buffers and loops both without runtime trimming',async()=>{
 settings.music=1;await load('menu_music_source');activation.resolve();await flush();
 audio.beginMatch();await load('match-b-90s');
 expect(starts).toEqual(['menu_music_source','match-b-90s']);
 expect(context.createBuffer).not.toHaveBeenCalled();
 const sources=context.createBufferSource.mock.results.map(r=>r.value);
 expect(sources.map(s=>s.loop)).toEqual([true,true]);
 expect(sources.map(s=>(s.buffer as {name:string}).name)).toEqual(starts);
});
it('independently level-matches menu and match and updates volume without restarting',async()=>{
 settings.music=1;await load('menu_music_source');activation.resolve();await flush();
 const menuGain=context.createGain.mock.results[0].value.gain;
 expect(menuGain.value).toBeCloseTo(menuOrganLevel*menuMusicCompensation);
 settings.music=.5;fire('checkers-settings-change');
 expect(menuGain.value).toBeCloseTo(.5*menuOrganLevel*menuMusicCompensation);
 audio.beginMatch();await load('match-b-90s');
 const matchGain=context.createGain.mock.results[1].value.gain;
 expect(matchGain.value).toBeCloseTo(.5*matchMusicLevel*matchMusicCompensation);
 expect(matchGain.value).toBeLessThan(menuGain.value);
 settings.master=.4;fire('checkers-settings-change');
 expect(matchGain.value).toBeCloseTo(.4*.5*matchMusicLevel*matchMusicCompensation);
 expect(starts).toEqual(['menu_music_source','match-b-90s']);
});
it('does not resume music until BOTH hidden and platform pauses clear',async()=>{
 settings.music=1;activation.resolve();fire('pointerdown','opening-play');await flush();
 audio.beginMatch();await load('match-b-90s');expect(starts).toEqual(['match-b-90s']);
 hidden=true;fire('visibilitychange');pause();
 hidden=false;fire('visibilitychange');expect(starts).toEqual(['match-b-90s']);
 resume();expect(starts).toEqual(['match-b-90s','match-b-90s']);
 expect(stops).toEqual(['match-b-90s']);
});
it('keeps match music through result and stops it when returning to menu',async()=>{
 settings.music=1;activation.resolve();fire('pointerdown','opening-play');await flush();
 audio.beginMatch();await load('match-b-90s');
 audio.resultCeremonySound(false);expect(stops).toEqual([]);
 audio.show();await load('menu_music_source');
 expect(stops).toEqual(['match-b-90s']);
 expect(starts).toEqual(['match-b-90s','menu_music_source']);
});
it('drops failed music decode without preventing match or short cues',async()=>{
 settings.music=1;activation.resolve();fire('pointerdown','opening-play');await flush();
 audio.beginMatch();context.decodeAudioData.mockRejectedValueOnce(Error('decode failed'));
 await load('match-b-90s');await load('turn-handoff');audio.turnHandoff();
 expect(starts).toEqual(['turn-handoff']);
});

it('keeps duck ownership across sync, replacement, old ended and settings changes',async()=>{
 settings.music=1;activation.resolve();fire('pointerdown','opening-play');await flush();
 audio.beginMatch();await load('match-b-90s');await load('victory');await load('time-low');
 const gain=context.createGain.mock.results[0].value.gain;
 audio.resultSting(true,'victory','black');
 const old=context.createBufferSource.mock.results.slice(-1)[0].value;
 expect(gain.value).toBeCloseTo(matchMusicLevel*matchMusicCompensation*matchMusicDuck);
 audio.speakOrcTurn('time-low','black');
 const owner=context.createBufferSource.mock.results.slice(-1)[0].value;
 (old.onended as unknown as ()=>void)();
 fire('checkers-settings-change');settings.music=.5;fire('checkers-settings-change');
 expect(gain.value).toBeCloseTo(.5*matchMusicLevel*matchMusicCompensation*matchMusicDuck);
 expect(gain.cancelScheduledValues).toHaveBeenCalled();
 (owner.onended as unknown as ()=>void)();
 expect(gain.value).toBeCloseTo(.5*matchMusicLevel*matchMusicCompensation);
});
it('starts a late decoded match bed ducked under an active voice',async()=>{
 settings.music=1;activation.resolve();fire('pointerdown','opening-play');await flush();
 audio.beginMatch();await load('victory');audio.resultSting(true,'victory','black');await load('match-b-90s');
 expect(context.createGain.mock.results.slice(-1)[0].value.gain.value).toBeCloseTo(matchMusicLevel*matchMusicCompensation*matchMusicDuck);
});
it('emits gate stop once across online hide/begin/hide and resets on new opening',async()=>{
 await load('gate_stop');activation.resolve();fire('pointerdown');await flush();
 audio.hide(true);audio.beginMatch();audio.hide(true);audio.beginMatch();
 expect(starts).toEqual(['gate_stop']);expect(stops).toEqual([]);
 audio.show();audio.depart();audio.hide(true);expect(starts).toEqual(['gate_stop','gate_stop']);
});
it('consumes muted or cold gate completion without stale replay',async()=>{
 activation.resolve();fire('pointerdown');await flush();audio.hide(true);await load('gate_stop');audio.hide(true);
 expect(starts).toEqual([]);audio.show();settings.muted=true;audio.hide(true);settings.muted=false;audio.hide(true);
 expect(starts).toEqual([]);
});
it('bounds frequent UI and piece categories independently',async()=>{
 await load('ui-tap');await load('move-w');activation.resolve();fire('pointerdown');await flush();audio.beginMatch();
 for(let i=0;i<30;i++){uiSfx('ui-tap');pieceStepSfx(false,false,'white');}
 expect(starts.filter(x=>x==='ui-tap').length-stops.filter(x=>x==='ui-tap').length).toBe(2);
 expect(starts.filter(x=>x==='move-w').length-stops.filter(x=>x==='move-w').length).toBe(4);
 pause();const count=starts.length;uiSfx('ui-tap');resume();expect(starts).toHaveLength(count);
});
it.each(['ui-open','ui-close','ui-tap','panel-ready','undo-applied','draw-result'] as const)('never replays cold/muted/paused %s',async cue=>{
 activation.resolve();fire('pointerdown');await flush();uiSfx(cue);await load(cue);expect(starts).toEqual([]);
 settings.muted=true;uiSfx(cue);settings.muted=false;pause();uiSfx(cue);resume();expect(starts).toEqual([]);
 uiSfx(cue);expect(starts).toEqual([cue]);
});

it('requests capture and promotion first at high priority, once per activation',async()=>{
 fire('pointerdown','elsewhere');await flush();
 const calls=vi.mocked(fetch).mock.calls;
 expect(calls[0][0]).toContain('/crush-b.wav');
 expect(calls[1][0]).toContain('/ignite-a.wav');
 expect(calls[0][1]).toEqual({priority:'high'});
 expect(calls[1][1]).toEqual({priority:'high'});
 fire('pointerdown','elsewhere');await flush();
 for(const cue of ['crush-b','ignite-a'])expect(vi.mocked(fetch).mock.calls.filter(([url])=>String(url).includes(`/${cue}.`))).toHaveLength(1);
});

it.each([['crush-b',1.4],['ignite-a',1.6],['ui-open',.6],['panel-ready',.6],['undo-applied',.6]] as const)('applies measured %s gain through master and effects, once',async(cue,level)=>{
 await load(cue); activation.resolve(); await flush(); audio.beginMatch();
 settings.master=.4; settings.effects=.5;
 if(cue==='crush-b'){pieceCaptureSfx('black');cancelPieceAh();}
 else if(cue==='ignite-a')kingFireIgniteSfx(true);
 else uiSfx(cue);
 expect(starts).toEqual([cue]);
 expect(context.createGain.mock.results.at(-1)!.value.gain.value).toBeCloseTo(.4*.5*.65*level);
});

it.each([false,true])('drops cold functional cues, then plays the next ready event once (reduced=%s)',async(reduced)=>{
 activation.resolve();fire('pointerdown','elsewhere');await flush();audio.beginMatch();
 pieceCaptureSfx('black');cancelPieceAh();kingFireIgniteSfx(reduced);
 expect(starts).toEqual([]);
 await load('crush-b');await load('ignite-a');
 expect(starts).toEqual([]);
 pieceCaptureSfx('white');cancelPieceAh();kingFireIgniteSfx(reduced);
 expect(starts).toEqual(['crush-b','ignite-a']);
});

it.each(['mute','hidden','pause','effects','master'])('functional capture/promotion respect %s without deferred replay',async(reason)=>{
 await load('crush-b');await load('ignite-a');activation.resolve();await flush();audio.beginMatch();
 if(reason==='mute')settings.muted=true;
 if(reason==='hidden')hidden=true;
 if(reason==='pause')pause();
 if(reason==='effects')settings.effects=0;
 if(reason==='master')settings.master=0;
 pieceCaptureSfx('black');cancelPieceAh();kingFireIgniteSfx(true);
 expect(starts).toEqual([]);
 settings.muted=false;settings.master=1;settings.effects=1;hidden=false;resume();
 expect(starts).toEqual([]);
 pieceCaptureSfx('white');cancelPieceAh();kingFireIgniteSfx(false);
 expect(starts).toEqual(['crush-b','ignite-a']);
});
