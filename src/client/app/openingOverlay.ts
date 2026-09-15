import type Phaser from 'phaser';
import {createMenuAudio} from './menuAudio';
import {gatePose, OpeningGates} from './openingGates';
import {gateDurationMs as preparationMs} from './openingGates';

declare global {
 interface Window {
  checkersStartup: { watchdog: number; fail: (message: string) => void; ready: () => void; status: (message: string) => void };
 }
}

/** HTML-first controls survive asset failures; the board behind them is real Phaser. */
export function createOpeningOverlay(scene: Phaser.Scene, handlers: { onPlayBot: () => void; isPaused?: () => boolean }) {
 const root = document.getElementById('opening')!;
 const play = document.getElementById('opening-play') as HTMLButtonElement;
 const retry = document.getElementById('opening-retry')!;
 const motion = matchMedia('(prefers-reduced-motion: reduce)');
 const gates = new OpeningGates();
 const audio=createMenuAudio(scene.registry.get('sdk'));
 let sampledAt: number | null = null, firstShow = true;
 const paint = (ms: number) => {
  if(gates.active)audio.gate(ms,motion.matches);
  const p=gatePose(ms);
  root.style.setProperty('--gate-open',String(p.doors));
  root.style.setProperty('--gate-slide',String(p.slide));
  root.style.setProperty('--gate-title',String(p.title));
  root.style.setProperty('--gate-press',String(p.press));
 };
 const closeDialogs = () => {
  for (const id of ['opening-help-dialog','opening-settings-dialog']) {
   const dialog=document.getElementById(id) as HTMLDialogElement;
   if(dialog.open) dialog.close();
  }
 };
 const hide = (completed=false) => {
  audio.hide(completed,motion.matches);
  gates.cancel(); closeDialogs(); root.hidden=true; root.inert=false;
  root.classList.remove('is-departing');
  document.getElementById('game')!.inert=false;
  scene.game.canvas.focus({preventScroll:true});
 };
 const visibilityChange = () => { sampledAt=null; };
 const update = () => {
  const now=scene.time.now, delta=sampledAt===null?0:now-sampledAt;
  sampledAt=now;
  if(!gates.active || document.hidden || handlers.isPaused?.()) return;
  gates.advance(motion.matches ? preparationMs : delta);
  if(gates.active) paint(gates.elapsed);
 };
 play.onclick=()=>{if(!play.disabled&&!root.hidden&&!gates.active&&!root.inert) handlers.onPlayBot();};
 clearTimeout(window.checkersStartup.watchdog);
 play.disabled=false;play.textContent='Играть';play.removeAttribute('aria-label');
 play.setAttribute('aria-busy','false');play.hidden=false;retry.hidden=true;
 window.checkersStartup.ready();
 document.addEventListener('visibilitychange',visibilityChange);
 scene.events.on('update',update);
 scene.events.once('shutdown',()=>{
  gates.cancel();audio.dispose();play.onclick=null;
  scene.events.off('update',update);
  document.removeEventListener('visibilitychange',visibilityChange);
  root.inert=false;root.classList.remove('is-departing');paint(0);
 });
 return {
  layout: (_width:number,_height:number)=>undefined,
  show:()=>{
   audio.show();
   gates.cancel();sampledAt=null;paint(0);root.inert=false;root.classList.remove('is-departing');
   play.disabled=false;root.hidden=false;document.getElementById('game')!.inert=true;
   if(!firstShow)play.focus({preventScroll:true});firstShow=false;
  },
  hide,
  depart:(done:()=>void)=>{
   audio.depart();
   closeDialogs();root.inert=true;play.disabled=true;root.classList.add('is-departing');
   sampledAt=scene.time.now;
   gates.start(()=>{paint(preparationMs);hide(true);done();});
   paint(0);
  },
  beginMatch:()=>audio.beginMatch(),
  hintWave:()=>audio.hintWave(),
  arenaVoice:()=>audio.arenaVoice(),
  speakOrcTurn:(name:string)=>audio.speakOrcTurn(name),
  revealAudio:(ms:number,reduced:boolean)=>audio.reveal(ms,reduced),
 };
}
