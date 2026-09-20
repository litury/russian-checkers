import type {IYandexSdk} from './IYandexSdk';
import {MenuAudioPolicy,menuMusicShouldPlay,menuMusicStopsInstantly,menuMusicFadeSec,matchMusicShouldPlay} from './menuAudioPolicy';
import {matchMusicDuck,matchMusicLevel,menuOrganLevel,sfxBus,voiceBus} from './audioMix';
import {menuClickLevel,menuBackSound} from './menuClickLevel';
import {previewLoop,mechanismEnvelope} from './menuAudioPreview';
import {startPanelWindows,startTimerLock,startTimerSlide} from './startAudio';
import {orcArenaLine} from './orcTurn';
import {announcerCue} from './announcer';
import {bindKingFireSfx} from './kingFireSfx';
import {bindPieceSfx,bindPieceVoice,cancelPieceAh,voiceStealSec} from './pieceSfx';
const urls=import.meta.glob('./audio/menu/*',{eager:true,query:'?url',import:'default'}) as Record<string,string>;
/** The old Phaser sound manager is disabled. This menu-only Web Audio owner uses
 * the existing persisted settings and SDK, never creates an HTML media player. */
export function createMenuAudio(sdk:IYandexSdk) {
 const policy=new MenuAudioPolicy();
 let ctx:AudioContext|undefined, music:AudioBufferSourceNode|undefined, musicGain:GainNode|undefined;
 let match:AudioBufferSourceNode|undefined, matchGain:GainNode|undefined;
 const buffers=new Map<string,AudioBuffer>(), effects=new Set<AudioBufferSourceNode>();
 let voice:AudioBufferSourceNode|undefined, voiceGain:GainNode|undefined, voiceBark=false;
 let unlocked=false, musicEnded=false, fadeGen=0, fading=false;
 let epoch=0, clickSerial=0;
 const loading=new Map<string,Promise<void>>();
 const mechanisms=new Map<string,{source:AudioBufferSourceNode,gain:GainNode}|null>();
 // Producer can replace this technical preview with an approved loop later.
 const loop={enabled:true,start:0,end:0}; // Temporary crossfaded preview, NOT approved master.
 const settings=()=>window.checkersSettings.get();
 const stopEffects=()=>{cancelPieceAh();if(voice){try{voice.stop()}catch{}voice=undefined;voiceGain=undefined;voiceBark=false;}for(const s of effects){try{s.stop()}catch{}}effects.clear();};
 const stopMusic=()=>{fadeGen++;fading=false;if(music){music.onended=null;try{music.stop()}catch{}music=undefined;}musicGain=undefined;};
 const stopMatch=()=>{if(match){match.onended=null;try{match.stop()}catch{}match=undefined;}matchGain=undefined;};
 const matchLevel=()=>settings().master*settings().music*matchMusicLevel;
 const startMatch=()=>{
  if(match||!ctx||ctx.state!=='running')return;
  const buffer=buffers.get('match-b-90s');if(!buffer)return;
  match=ctx.createBufferSource();match.buffer=buffer;match.loop=true;
  matchGain=ctx.createGain();matchGain.gain.value=matchLevel();
  match.connect(matchGain).connect(ctx.destination);match.start();
 };
 const duckMatch=(on:boolean)=>{
  if(!matchGain||!ctx)return;
  matchGain.gain.setTargetAtTime(matchLevel()*(on?matchMusicDuck:1),ctx.currentTime,.08);
 };
 const fadeMusic=()=>{
  if(fading||!music||!musicGain||!ctx)return;
  fading=true;
  const n=++fadeGen,t=ctx.currentTime;
  musicGain.gain.cancelScheduledValues(t);
  musicGain.gain.setValueAtTime(musicGain.gain.value,t);
  musicGain.gain.linearRampToValueAtTime(0,t+menuMusicFadeSec);
  window.setTimeout(()=>{if(n===fadeGen)stopMusic();},menuMusicFadeSec*1000);
 };
 const sync=()=>{
  policy.muted=settings().muted;policy.hidden=document.hidden;
  if(!policy.audible||!settings().effects||!settings().master){epoch++;stopEffects();}
  if(menuMusicShouldPlay(policy,unlocked,settings().music)){
   const level=settings().master*settings().music*menuOrganLevel;
   if(musicGain&&music&&ctx){
    fadeGen++;fading=false;musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.setTargetAtTime(level,ctx.currentTime,.08);
   }else if(!music&&!musicEnded&&ctx?.state==='running'){
    const buffer=buffers.get('menu_music_source');
    if(buffer){
     music=ctx.createBufferSource();music.buffer=buffer;music.loop=loop.enabled;
     if(loop.enabled){music.loopStart=loop.start;music.loopEnd=loop.end;}
     musicGain=ctx.createGain();musicGain.gain.value=level;
     music.connect(musicGain).connect(ctx.destination);
     music.onended=()=>{music=undefined;musicEnded=true;};music.start();
    }
   }
  }else if(menuMusicStopsInstantly(policy,unlocked,settings().music))stopMusic();
  else fadeMusic();
  if(matchMusicShouldPlay(policy,unlocked,settings().music)){
   if(matchGain&&match&&ctx)matchGain.gain.setTargetAtTime(matchLevel(),ctx.currentTime,.08);
   else startMatch();
  }else stopMatch();
 };
 const prepare=()=>{
  if(ctx)return;
  try {ctx=new AudioContext();}catch{return;}
  for(const [path,url] of Object.entries(urls)){
   const name=path.split('/').pop()!.replace(/\.[^.]+$/,'');
   const ready=fetch(url).then(r=>{if(!r.ok)throw Error('audio unavailable');return r.arrayBuffer();})
    .then(b=>ctx!.decodeAudioData(b)).then(b=>{
     if(name==='menu_music_source'||name==='match-b-90s'){
      const fade=Math.floor(b.sampleRate),out=ctx!.createBuffer(b.numberOfChannels,b.length-fade,b.sampleRate);
      for(let c=0;c<b.numberOfChannels;c++)out.copyToChannel(previewLoop(b.getChannelData(c),fade) as Float32Array<ArrayBuffer>,c);
      b=out;
     }
     buffers.set(name,b);sync();
    }).catch(()=>{});
   loading.set(name,ready);
  }
 };
 const sound=(name:string,level=1)=>{
  sync();if(!policy.audible||!unlocked||ctx?.state!=='running'||!settings().effects)return;
  const buffer=buffers.get(name);if(!buffer)return; // Never queue a stale click.
  const s=ctx.createBufferSource(),g=ctx.createGain();s.buffer=buffer;
  g.gain.value=settings().master*settings().effects*sfxBus*level;s.connect(g).connect(ctx.destination);
  effects.add(s);s.onended=()=>{effects.delete(s);s.disconnect();g.disconnect();};s.start();
  return {source:s,gain:g};
 };
 const cutBark=()=>{
  if(!voiceBark||!voice)return;
  try{voice.stop()}catch{}effects.delete(voice);voice=undefined;voiceGain=undefined;voiceBark=false;duckMatch(false);
 };
 const say=(name:string,level=1)=>{
  if(voice&&voiceGain&&ctx){
   const dying=voice,g=voiceGain,t=ctx.currentTime;
   g.gain.cancelScheduledValues(t);
   g.gain.setValueAtTime(g.gain.value,t);
   g.gain.linearRampToValueAtTime(0,t+voiceStealSec);
   window.setTimeout(()=>{try{dying.stop()}catch{}effects.delete(dying);},voiceStealSec*1000);
   voice=undefined;voiceGain=undefined;voiceBark=false;duckMatch(false);
  }else if(voice){try{voice.stop()}catch{}effects.delete(voice);voice=undefined;voiceGain=undefined;voiceBark=false;duckMatch(false);}
  duckMatch(true);
  sync();if(!policy.audible||!unlocked||ctx?.state!=='running'||!settings().effects){duckMatch(false);return;}
  const buffer=buffers.get(name);if(!buffer){duckMatch(false);return;}
  const s=ctx.createBufferSource(),g=ctx.createGain();s.buffer=buffer;
  g.gain.value=settings().master*settings().effects*voiceBus*level;s.connect(g).connect(ctx.destination);
  effects.add(s);s.onended=()=>{duckMatch(false);effects.delete(s);s.disconnect();g.disconnect();if(voice===s){voice=undefined;voiceGain=undefined;voiceBark=false;}};
  voice=s;voiceGain=g;voiceBark=level<1;s.start();
 };
 const gesture=(event:Event)=>{
  if(!event.isTrusted)return;
  const target=event.target as HTMLElement;
  // Toggle intent is known on click, not pointerdown/keydown: no disable blip.
  // Mute toggle intent is click-only; pointerdown while already audible would blip.
  // Unmute must resume in this trusted gesture so later source.start is not deferred.
  if(target.closest('#opening-sound')){
   if(!settings().muted)return;
   prepare();if(!ctx)return;
   void ctx.resume().then(()=>{unlocked=ctx!.state==='running';sync();}).catch(()=>{});
   return;
  }
  if(target.closest('#opening-play'))policy.departing=true; // No first-Play music blip.
  prepare();if(!ctx)return;
  void ctx.resume().then(()=>{unlocked=ctx!.state==='running';sync();}).catch(()=>{});
};
 const click=(event:Event)=>{
  if(!event.isTrusted)return;
  // Every newer click supersedes pending feedback, even outside these controls.
  const serial=++clickSerial,target=event.target as HTMLElement;
  if(target.closest('#opening-sound')){
   // HTML owns persisted mute; resume in this trusted enabling activation,
   // before its target handler changes settings. Never auto-unmute.
   if(settings().muted){
    prepare();
    void ctx?.resume().then(()=>{unlocked=ctx?.state==='running';sync();}).catch(()=>{});
   }
   return;
  }
  const play=Boolean(target.closest('#opening-play'));
  if(!play&&!target.closest('#opening-help,#opening-settings'))return;
  sync();if(!policy.audible||!policy.menu||!settings().effects||!settings().master)return;
  if(play)policy.departing=true; // Also cover trusted click-only activation.
  const name=play?'play-b':'ui_click',run=epoch,at=performance.now();
  const emit=()=>{if(play)sound('play-b');else sound('ui_click',menuClickLevel);};
  if(ctx?.state==='running'&&buffers.has(name)){unlocked=true;emit();return;}
  prepare();
  // Only this cue and this trusted activation; music never gates game startup.
  void Promise.all([ctx?.resume(),loading.get(name)]).then(()=>{
   if(serial!==clickSerial||run!==epoch||performance.now()-at>350||(!play&&policy.departing))return;
   unlocked=ctx?.state==='running';emit();
  }).catch(()=>{});
 };
 document.addEventListener('pointerdown',gesture,true);document.addEventListener('keydown',gesture,true);
 document.addEventListener('click',click,true);
 document.addEventListener('visibilitychange',sync);
 window.addEventListener('checkers-settings-change',sync);
 sdk.onPause(()=>{policy.platform=true;sync();});sdk.onResume(()=>{policy.platform=false;sync();});
 for(const id of ['opening-help-dialog','opening-settings-dialog'])document.getElementById(id)!.addEventListener('close',()=>sound(menuBackSound,menuClickLevel));
 prepare();sync();
 bindKingFireSfx(sound);
 bindPieceSfx(sound);
 bindPieceVoice(say,cutBark);
 return {
  show(){epoch++;mechanisms.clear();policy.menu=true;policy.match=false;policy.departing=false;musicEnded=false;stopEffects();stopMatch();sync();},
  hide(completed=false,reduced=false){epoch++;stopEffects();if(completed&&!reduced)sound('gate_stop');policy.menu=false;policy.departing=false;if(completed)policy.match=true;mechanisms.clear();sync();},
  // Normal departure belongs to the Play intent; hide/show still invalidate it.
  depart(){mechanisms.clear();policy.departing=true;sync();},
  beginMatch(){epoch++;policy.match=true;policy.menu=false;policy.departing=false;mechanisms.clear();sync();},
  hintWave(){sound('availability-wave',.85);},
  arenaVoice(humanSide:'white'|'black'='white'){say(announcerCue(humanSide,orcArenaLine));},
  speakOrcTurn(name:string,humanSide:'white'|'black'='white'){say(announcerCue(humanSide,name));},
  resultSting(win:boolean,line:string,humanSide:'white'|'black'='white'){sound(win?'win':'lose');say(announcerCue(humanSide,line));},
  reveal(ms:number,reduced:boolean){
   for(const [id,start,end,name,level] of [
    ['timer-slide',startTimerSlide[0],startTimerSlide[1],'timer-slide',.9],
    ['timer-lock',startTimerLock[0],startTimerLock[1],'timer-lock',1],
   ] as const){
    if(!mechanisms.has(id)&&ms>=start){mechanisms.set(id,!reduced&&ms<end?sound(name,0)??null:null);}
    const m=mechanisms.get(id);
    if(m&&effects.has(m.source)){
     m.gain.gain.setTargetAtTime(reduced?0:settings().master*settings().effects*sfxBus*level*mechanismEnvelope(ms,start,end),ctx!.currentTime,.008);
     if(ms>=end||reduced){m.source.stop();mechanisms.set(id,null);}
    }
   }
  },
  gate(ms:number,reduced:boolean){

   // Same scene-time windows as gatePose/CSS; no phrase-typing sounds.
   for(const [id,start,end,name,level] of [
    ['unlock',400,1160,'gate_unlock',1],
    ...startPanelWindows,
    ['doors',1160,2000,'gate_motion',1],
   ] as const){
    if(!mechanisms.has(id)&&ms>=start){mechanisms.set(id,!reduced&&ms<end?sound(name,0)??null:null);}
    const m=mechanisms.get(id);
    if(m&&effects.has(m.source)){
     m.gain.gain.setTargetAtTime(reduced?0:settings().master*settings().effects*sfxBus*level*mechanismEnvelope(ms,start,end),ctx!.currentTime,.008);
     if(ms>=end||reduced){m.source.stop();mechanisms.set(id,null);}
    }
   }
  },
  dispose(){bindKingFireSfx(()=>{});bindPieceSfx(()=>{});bindPieceVoice(()=>{});policy.menu=false;stopEffects();stopMusic();stopMatch();document.removeEventListener('pointerdown',gesture,true);document.removeEventListener('keydown',gesture,true);document.removeEventListener('click',click,true);document.removeEventListener('visibilitychange',sync);window.removeEventListener('checkers-settings-change',sync);void ctx?.close();},
 };
}
