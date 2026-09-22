import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {createMenuAudio} from './menuAudio';
import type {IYandexSdk} from './IYandexSdk';

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
 createBuffer(){return {name:'menu_music_source',copyToChannel(){}};}
 createGain(){return {gain:{value:0,cancelScheduledValues(){},setValueAtTime(){},linearRampToValueAtTime(){},setTargetAtTime(){}},connect(){return this;},disconnect(){}};}
 createBufferSource(){return {buffer:null as unknown,loop:false,onended:null,connect:(node:unknown)=>node,disconnect(){},stop(){stops.push((this.buffer as {name:string}).name);},start(){starts.push((this.buffer as {name:string}).name);}};}
}
function fire(type:string,id='opening-play',trusted=true){
 handlers.get(type)?.({isTrusted:trusted,target:{closest:(selector:string)=>selector.split(',').includes(`#${id}`)}} as unknown as Event);
}
async function load(name:string){
 const entry=[...requests].find(([url])=>url.includes(`/${name}.`));
 expect(entry,`asset ${name}`).toBeDefined();
 entry![1].resolve({ok:true,arrayBuffer:async()=>({name,sampleRate:2,length:8,numberOfChannels:1,getChannelData:()=>new Float32Array(8)})} as unknown as Response);
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

it.each(['mute','hidden','pause'])('stops active menu music immediately on %s',async(reason)=>{
 settings.music=1;await load('menu_music_source');
 activation.resolve();fire('pointerdown','elsewhere');await flush();
 expect(starts).toEqual(['menu_music_source']);
 if(reason==='mute'){settings.muted=true;fire('checkers-settings-change');}
 if(reason==='hidden'){hidden=true;fire('visibilitychange');}
 if(reason==='pause')pause();
 expect(stops).toEqual(['menu_music_source']);
});

it('resumes within trusted sound enabling click, but never clears mute itself',async()=>{
 settings.muted=true;
 fire('click','opening-sound');
 expect(context.resume).toHaveBeenCalledTimes(1);
 expect(settings.muted).toBe(true);
});
it('does not unlock on sound-disable pointerdown or synthetic enable',()=>{
 fire('pointerdown','opening-sound');
 fire('click','opening-sound',false);
 expect(context.resume).not.toHaveBeenCalled();
});
it('resumes on muted sound pointerdown so unmute can start sources',async()=>{
 settings.muted=true;settings.music=1;await load('menu_music_source');
 fire('pointerdown','opening-sound');
 expect(context.resume).toHaveBeenCalledTimes(1);
 settings.muted=false;fire('checkers-settings-change');
 activation.resolve();await flush();
 expect(starts).toEqual(['menu_music_source']);
});
it('starts menu music after trusted unmute click once the context is running',async()=>{
 settings.muted=true;settings.music=1;await load('menu_music_source');
 fire('click','opening-sound');
 settings.muted=false;fire('checkers-settings-change');
 expect(starts).toEqual([]);
 activation.resolve();await flush();
 expect(starts).toEqual(['menu_music_source']);
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
it('keeps cold help feedback working',async()=>{
 fire('pointerdown','opening-help');fire('click','opening-help');activation.resolve();await load('ui_click');
 expect(starts).toEqual(['ui_click']);
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
