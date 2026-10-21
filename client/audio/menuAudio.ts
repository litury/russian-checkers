import type {IYandexSdk} from '../platform/sdk/IYandexSdk';
import {loadBytes} from '../platform/browser/assetLoader';
import {MenuAudioPolicy,menuMusicShouldPlay,menuMusicStopsInstantly,menuMusicFadeSec,matchMusicShouldPlay} from './menuAudioPolicy';
import {matchMusicDuck,matchMusicLevel,menuOrganLevel,sfxBus,voiceBus,uiOpenLevel,panelReadyLevel,undoAppliedLevel} from './audioMix';
import {menuClickLevel,menuBackSound} from './menuClickLevel';
import {bindMenuPressSound} from './menuPressSound';
import {mechanismEnvelope} from './menuAudioPreview';
import {menuMusicCompensation,matchMusicCompensation} from './musicDelivery';
import {startPanelWindows,startTimerLock,startTimerSlide} from './startAudio';
import {orcArenaLine} from './orcTurn';
import {announcerCue} from './announcer';
import {bindKingFireSfx} from './kingFireSfx';
import {bindPieceSfx,bindPieceVoice,cancelPieceAh,voiceStealSec} from './pieceSfx';
import {bindUiSfx} from './uiSfx';
import {sfxCategory} from './sfxLimits';
const urls=import.meta.glob('./assets/*',{eager:true,query:'?url',import:'default'}) as Record<string,string>;
const AUDIO_SOURCE_ALIASES: Record<string, string> = {
 './assets/elf-time-up.mp3': './assets/time-up.mp3',
 './assets/elf-time-low.mp3': './assets/time-low.mp3',
 './assets/play-b.wav': './assets/ui-open.wav',
 './assets/b-click.wav': './assets/move-w.wav',
 './assets/ui_click.wav': './assets/ui-tap.wav',
};
for (const [alias, source] of Object.entries(AUDIO_SOURCE_ALIASES)) urls[alias] = urls[source];
/** The old Phaser sound manager is disabled. This menu-only Web Audio owner uses
 * the existing persisted settings and SDK, never creates an HTML media player. */
export function createMenuAudio(sdk:IYandexSdk) {
 const policy=new MenuAudioPolicy();
 let ctx:AudioContext|undefined, music:AudioBufferSourceNode|undefined, musicGain:GainNode|undefined;
 let match:AudioBufferSourceNode|undefined, matchGain:GainNode|undefined;
 const buffers=new Map<string,AudioBuffer>(), effects=new Set<AudioBufferSourceNode>();
 const limited=new Map<AudioBufferSourceNode,string>();
 const retiringVoices=new Set<AudioBufferSourceNode>();
 let gateStopped=false;
 let voice:AudioBufferSourceNode|undefined, voiceGain:GainNode|undefined, voiceBark=false;
 let unlocked=false, musicEnded=false, fadeGen=0, fading=false;
 let epoch=0, clickSerial=0;
 const loading=new Map<string,Promise<void>>();
 const mechanisms=new Map<string,{source:AudioBufferSourceNode,gain:GainNode}|null>();

 const settings=()=>window.checkersSettings.get();
 const stopEffects=()=>{cancelPieceAh();voice=undefined;voiceGain=undefined;voiceBark=false;for(const s of effects){try{s.stop()}catch{}}effects.clear();limited.clear();retiringVoices.clear();duckMatch();};
 const stopMusic=()=>{fadeGen++;fading=false;if(music){music.onended=null;try{music.stop()}catch{}music=undefined;}musicGain=undefined;};
 const stopMatch=()=>{if(match){match.onended=null;try{match.stop()}catch{}match=undefined;}matchGain=undefined;};
 const matchLevel=()=>settings().master*settings().music*matchMusicLevel*matchMusicCompensation*(voice?matchMusicDuck:1);
 const startMatch=()=>{
  if(match||!ctx||ctx.state!=='running')return;
  const buffer=buffers.get('match-b-90s');if(!buffer)return;
  match=ctx.createBufferSource();match.buffer=buffer;match.loop=true;
  matchGain=ctx.createGain();matchGain.gain.value=matchLevel();
  match.connect(matchGain).connect(ctx.destination);match.start();
 };
 const duckMatch=()=>{
  if(!matchGain||!ctx)return;
  matchGain.gain.cancelScheduledValues(ctx.currentTime);
  matchGain.gain.setTargetAtTime(matchLevel(),ctx.currentTime,.08);
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
  if(prepared&&policy.audible){

   if(settings().music&&policy.menu&&!policy.departing&&!window.checkersStartup?.pendingPlay&&!window.checkersStartup?.playCommitted)requestBuffer('menu_music_source');
   if(settings().music&&policy.match&&!policy.menu)requestBuffer('match-b-90s');
  }
  if(!policy.audible||!settings().effects||!settings().master){epoch++;stopEffects();}
  if(menuMusicShouldPlay(policy,unlocked,settings().music)){
   const level=settings().master*settings().music*menuOrganLevel*menuMusicCompensation;
   if(musicGain&&music&&ctx){
    fadeGen++;fading=false;musicGain.gain.cancelScheduledValues(ctx.currentTime);
    musicGain.gain.setTargetAtTime(level,ctx.currentTime,.08);
   }else if(!music&&!musicEnded&&ctx?.state==='running'){
    const buffer=buffers.get('menu_music_source');
    if(buffer){
     music=ctx.createBufferSource();music.buffer=buffer;music.loop=true;
     musicGain=ctx.createGain();musicGain.gain.value=level;
     music.connect(musicGain).connect(ctx.destination);
     music.onended=()=>{music=undefined;musicEnded=true;};music.start();
    }
   }
  }else if(menuMusicStopsInstantly(policy,unlocked,settings().music))stopMusic();
  else fadeMusic();
  if(matchMusicShouldPlay(policy,unlocked,settings().music)){
   if(matchGain&&match&&ctx)duckMatch();
   else startMatch();
  }else stopMatch();
 };
 let prepared=false, playfieldReady=false, disposed=false;
 // No deadline before the board pack. Match bed stays on demand; short cues stay
 // on the first gesture. Never await these bodies to reveal or accept a move.
 const deferredAudio=new Set(['menu_music_source']);
 const audioName=(path:string)=>path.split('/').pop()!.replace(/\.[^.]+$/,'');
 const requestBuffer=(name:string)=>{
  if(disposed||!ctx||ctx.state==='closed'||loading.has(name))return;
  // Readiness can arrive after first Play reset departing. Its committed intent
  // still owns the screen: don't fetch an inactive menu bed from warmDeferred.
  if(name==='menu_music_source'&&(policy.departing||window.checkersStartup?.pendingPlay||window.checkersStartup?.playCommitted))return;
  if(!playfieldReady&&deferredAudio.has(name))return;
  const url=Object.entries(urls).find(([path])=>audioName(path)===name)?.[1];
  if(!url)return;
  // Only these two functional one-shots get high transport priority. They have
  // no other consumer; loading still deduplicates requests and decoded buffers.
  const bytes=name==='crush-b'||name==='ignite-a'
   ? fetch(url,{priority:'high'}).then(response=>{if(!response.ok)throw Error('Audio unavailable');return response.arrayBuffer();})
   : loadBytes(url);
  const ready=bytes.then(b=>ctx!.decodeAudioData(b.slice(0))).then(b=>{
   // Accepted-source loops have a baked beat-aligned seam; preserve decoded PCM.
   buffers.set(name,b);sync();
  }).catch(()=>{});
  loading.set(name,ready);
 };
 const warmDeferred=()=>{
  if(disposed||!playfieldReady||!prepared||!ctx||ctx.state==='closed')return;
  // Theme belongs to an active menu, not to a departure already in progress.
  if(settings().music&&!policy.departing)requestBuffer('menu_music_source');
 };
 const prepare=()=>{
  if(prepared)return;
  if(!ctx)try {ctx=new AudioContext();}catch{return;}
  prepared=true;
  // Short cues warm only after activation. Music belongs to the active screen;
  // never download the menu theme while leaving for a game.
  // Rare, functional one-shots must not sit behind dozens of voice decodes.
  // Warm them on activation, without waiting in the move or replaying a cold miss.
  const critical=['crush-b','ignite-a'];
  for(const name of critical)requestBuffer(name);
  for(const path of Object.keys(urls)){
   const name=audioName(path);
   if(name!=='menu_music_source'&&name!=='match-b-90s'&&!critical.includes(name))requestBuffer(name);
  }
  if(settings().music&&!policy.departing)requestBuffer('menu_music_source');
 };
 const warmAudio=()=>{
  // Remember the gate even if AudioContext is still unavailable.
  playfieldReady=true;
  warmDeferred();
 };
 const sound=(name:string,level=1)=>{
  sync();if(disposed||!policy.audible||!unlocked||ctx?.state!=='running'||!settings().effects||!settings().master)return;
  const buffer=buffers.get(name);if(!buffer)return; // Never queue a stale click.
  const category=sfxCategory(name);
  const peers=[...limited].filter(([,key])=>key===category.key);
  if(peers.length>=category.cap){const old=peers[0][0];limited.delete(old);effects.delete(old);try{old.stop();}catch{}}
  const s=ctx.createBufferSource(),g=ctx.createGain();s.buffer=buffer;
  g.gain.value=settings().master*settings().effects*sfxBus*level;s.connect(g).connect(ctx.destination);
  limited.set(s,category.key);
  effects.add(s);s.onended=()=>{limited.delete(s);effects.delete(s);s.disconnect();g.disconnect();};s.start();
  return {source:s,gain:g};
 };
 const cutBark=()=>{
  if(!voiceBark||!voice)return;
  const old=voice;voice=undefined;voiceGain=undefined;voiceBark=false;try{old.stop()}catch{}effects.delete(old);duckMatch();
 };
 const say=(name:string,level=1)=>{
  sync();if(disposed||!policy.audible||!unlocked||ctx?.state!=='running'||!settings().effects||!settings().master)return;
  const buffer=buffers.get(name);if(!buffer)return;
  // At most one retiring tail. Its ended callback cannot release the new owner.
  for(const old of retiringVoices){try{old.stop();}catch{}effects.delete(old);}retiringVoices.clear();
  if(voice&&voiceGain&&ctx){
   const dying=voice,g=voiceGain,t=ctx.currentTime;
   g.gain.cancelScheduledValues(t);
   g.gain.setValueAtTime(g.gain.value,t);
   g.gain.linearRampToValueAtTime(0,t+voiceStealSec);
   retiringVoices.add(dying);dying.stop(t+voiceStealSec);
  }else if(voice){try{voice.stop()}catch{}effects.delete(voice);}
  const s=ctx.createBufferSource(),g=ctx.createGain();s.buffer=buffer;
  g.gain.value=settings().master*settings().effects*voiceBus*level;s.connect(g).connect(ctx.destination);
  effects.add(s);s.onended=()=>{retiringVoices.delete(s);effects.delete(s);s.disconnect();g.disconnect();if(voice===s){voice=undefined;voiceGain=undefined;voiceBark=false;duckMatch();}};
  voice=s;voiceGain=g;voiceBark=level<1;duckMatch();s.start();
 };
 const gesture=(event:Event)=>{
  if(!event.isTrusted)return;
  const target=event.target as HTMLElement;
  // Toggle intent is known on click, not pointerdown/keydown: no disable blip.
  // Mute toggle intent is click-only; pointerdown while already audible would blip.
  // Unmute must resume in this trusted gesture so later source.start is not deferred.
  if(target.closest('#settings-muted')){
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
  if(target.closest('#settings-muted')){
   // HTML owns persisted mute; resume in this trusted enabling activation,
   // before its target handler changes settings. Never auto-unmute.
   if(settings().muted){
    prepare();
    void ctx?.resume().then(()=>{unlocked=ctx?.state==='running';sync();}).catch(()=>{});
   }
   return;
  }
  const play=Boolean(target.closest('#opening-play'));
  const options=target.closest('#opening-options');
  if(!play&&!options&&!target.closest('#opening-help,#opening-settings'))return;
  sync();if(!policy.audible||!policy.menu||!settings().effects||!settings().master)return;
  if(play)policy.departing=true; // Also cover trusted click-only activation.
  const name=play?'play-b':options?'ui-open':'ui_click',run=epoch,at=performance.now();
  const emit=()=>sound(name,play?1:options?uiOpenLevel:menuClickLevel);
  if(ctx?.state==='running'&&buffers.has(name)){unlocked=true;emit();return;}
  prepare();
  // Only this cue and this trusted activation; music never gates game startup.
  void Promise.all([ctx?.resume(),loading.get(name)]).then(()=>{
   if(serial!==clickSerial||run!==epoch||performance.now()-at>350||(!play&&policy.departing))return;
   unlocked=ctx?.state==='running';emit();
  }).catch(()=>{});
 };
 let contactSerial=0;
 const menuContact=(event:Event,current:()=>boolean)=>{
  if(!event.isTrusted)return;
  sync();if(!policy.audible||!policy.menu||policy.departing||!settings().master||!settings().effects)return;
  const serial=++contactSerial,run=epoch,at=performance.now();
  const emit=()=>{if(serial===contactSerial&&run===epoch&&current()&&policy.menu&&!policy.departing&&performance.now()-at<90)sound('menu-contact',.45);};
  if(ctx?.state==='running'&&buffers.has('menu-contact')){unlocked=true;emit();return;}
  prepare();
  void Promise.all([ctx?.resume(),loading.get('menu-contact')]).then(()=>{unlocked=ctx?.state==='running';emit();}).catch(()=>{});
 };
 bindMenuPressSound(menuContact);
 document.addEventListener('pointerdown',gesture,true);document.addEventListener('keydown',gesture,true);
 document.addEventListener('click',click,true);
 document.addEventListener('visibilitychange',sync);
 window.addEventListener('checkers-settings-change',sync);
 sdk.onPause(()=>{policy.platform=true;sync();});sdk.onResume(()=>{policy.platform=false;sync();});
 for(const id of ['opening-help-dialog','opening-settings-dialog'])document.getElementById(id)!.addEventListener('close',()=>sound(menuBackSound,menuClickLevel));

 // No network before a native gesture. The engine itself is
 // imported only after the menu's first frame and the two-second critical window.
 try {ctx=new AudioContext();}catch{}
 sync();
 // A native Play may precede the deferred engine. The browser owns this flag;
 // synthetic DOM events cannot set it, and it never clears persisted mute.
 if(globalThis.navigator?.userActivation?.hasBeenActive && (window.checkersStartup?.pendingPlay || window.checkersStartup?.playCommitted)){
  policy.departing=!!(window.checkersStartup?.pendingPlay||window.checkersStartup?.playCommitted);
  prepare();void ctx?.resume().then(()=>{unlocked=ctx?.state==='running';sync();}).catch(()=>{});
 }
 bindKingFireSfx(sound);
 bindPieceSfx(sound);
 bindPieceVoice(say,cutBark);
 bindUiSfx(cue=>sound(cue,cue==='draw-result'?.5:cue==='ui-open'?uiOpenLevel:cue==='panel-ready'?panelReadyLevel:cue==='undo-applied'?undoAppliedLevel:.3));
 return {
  warmAudio,
  menuContact,
  show(){epoch++;gateStopped=false;mechanisms.clear();policy.menu=true;policy.match=false;policy.departing=false;musicEnded=false;stopEffects();stopMatch();sync();},
  hide(completed=false,reduced=false){epoch++;if(!gateStopped)stopEffects();if(completed&&!gateStopped){gateStopped=true;if(!reduced)sound('gate_stop');}policy.menu=false;policy.departing=false;if(completed)policy.match=true;mechanisms.clear();sync();},
  // Normal departure belongs to the Play intent; hide/show still invalidate it.
  depart(){if(!policy.departing)gateStopped=false;mechanisms.clear();policy.departing=true;sync();},
  beginMatch(){epoch++;policy.match=true;policy.menu=false;policy.departing=false;mechanisms.clear();sync();},
  // Explicit completed-ply event only; sound() owns mute/hidden/SDK/autoplay policy.
  turnHandoff(){if(policy.match&&!policy.menu&&settings().master>0)sound('turn-handoff',.45);},
  hintWave(){sound('availability-wave',.85);},
  arenaVoice(humanSide:'white'|'black'='white'){say(announcerCue(humanSide,orcArenaLine));},
  speakOrcTurn(name:string,humanSide:'white'|'black'='white'){say(announcerCue(humanSide,name));},
  resultSting(_win:boolean,line:string,humanSide:'white'|'black'='white'){say(announcerCue(humanSide,line));},
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
  dispose(){disposed=true;bindUiSfx(()=>{});bindMenuPressSound(()=>{});bindKingFireSfx(()=>{});bindPieceSfx(()=>{});bindPieceVoice(()=>{});policy.menu=false;stopEffects();stopMusic();stopMatch();document.removeEventListener('pointerdown',gesture,true);document.removeEventListener('keydown',gesture,true);document.removeEventListener('click',click,true);document.removeEventListener('visibilitychange',sync);window.removeEventListener('checkers-settings-change',sync);void ctx?.close();},
 };
}
