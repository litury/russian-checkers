import type Phaser from 'phaser';
import {createMenuAudio} from './menuAudio';
import {ensureGuest} from '@/online/cloud';
import {gatePose, OpeningGates} from './openingGates';
import {gateDurationMs as preparationMs} from './openingGates';
import {searchCopy, type SearchPhase} from './matchmakingSearch';

declare global {
 interface Window {
  checkersFlavor?: { setState: (next: string) => void };
  checkersStartup: {
   watchdog: number;
   pendingPlay?: boolean;
   playCommitted?: boolean;
   playIntent?: (() => void) | null;
   fail: (message: string) => void;
   unlock: () => void;
   waitPlay: () => void;
   ready: () => void;
   status: (message: string) => void;
  };
 }
}

/** HTML-first controls survive asset failures; the board behind them is real Phaser. */
export function createOpeningOverlay(scene: Phaser.Scene, handlers: {
 onPlayBot: () => void;
 onPlayOnline?: () => void;
 onSearchCancel?: () => void;
 onSearchStay?: () => void;
 onSearchBot?: () => void;
 isPaused?: () => boolean;
}) {
 const root = document.getElementById('opening')!;
 const play = document.getElementById('opening-play') as HTMLButtonElement;
 const online = document.getElementById('opening-online') as HTMLButtonElement | null;
 const search = document.getElementById('opening-search') as HTMLElement | null;
 const searchCopyEl = document.getElementById('opening-search-copy');
 const searchCancel = document.getElementById('opening-search-cancel') as HTMLButtonElement | null;
 const searchStay = document.getElementById('opening-search-stay') as HTMLButtonElement | null;
 const searchBot = document.getElementById('opening-search-bot') as HTMLButtonElement | null;
 const ivory = root.querySelector('.gate-piece-ivory') as HTMLElement | null;
 const ebony = root.querySelector('.gate-piece-black') as HTMLElement | null;
 let side: 'white' | 'black' = ivory?.classList.contains('is-chosen') ? 'white' : 'white';
 const paintSide = (next: 'white' | 'black') => {
  side = next;
  ivory?.classList.toggle('is-chosen', next === 'white');
  ebony?.classList.toggle('is-chosen', next === 'black');
 };
 paintSide('white');
 const pick = (next: 'white' | 'black') => (event: Event) => {
  event.preventDefault();
  event.stopPropagation();
  if (root.hidden || gates.active || root.inert) return;
  paintSide(next);
 };
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
 if (completed) window.checkersFlavor?.setState('ready');
 window.checkersStartup.playCommitted=false;
 window.checkersStartup.pendingPlay=false;
 clearSearch();
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
 const invoke = () => {
  // Allow invoke while waitPlay disabled the button (early click / residual load).
  if(root.hidden||gates.active||root.inert) return;
  handlers.onPlayBot();
 };
 const pickWhite = pick('white');
 const pickBlack = pick('black');
 play.onclick=()=>invoke();
 if (online) online.onclick=()=>{ if(root.hidden||root.inert) return; handlers.onPlayOnline?.(); };
 searchCancel?.addEventListener('click', () => handlers.onSearchCancel?.());
 searchStay?.addEventListener('click', () => handlers.onSearchStay?.());
 searchBot?.addEventListener('click', () => handlers.onSearchBot?.());
 const setSearch = (phase: SearchPhase, seconds: number) => {
  const view = searchCopy(phase, seconds);
  if (!search || !searchCopyEl) return;
  const on = phase !== 'idle';
  search.hidden = !on;
  root.classList.toggle('is-searching', view.hidePlay);
  searchCopyEl.textContent = view.title;
  if (searchCancel) searchCancel.hidden = !view.showCancel;
  if (searchStay) searchStay.hidden = !view.showStay;
  if (searchBot) searchBot.hidden = !view.showBot;
  window.checkersStartup.status(view.title || 'Всё готово. Первый ход ваш.');
 };
 const clearSearch = () => setSearch('idle', 0);
 ivory?.addEventListener('click', pickWhite);
 ebony?.addEventListener('click', pickBlack);
 window.checkersStartup.playIntent=invoke;
 clearTimeout(window.checkersStartup.watchdog);
 retry.hidden=true;
 play.hidden=false;
 // Keep pending/committed until invoke/auto-start so show()/unlock cannot idle the button.
 if(window.checkersStartup.pendingPlay || window.checkersStartup.playCommitted) window.checkersStartup.waitPlay();
 else { window.checkersStartup.unlock(); window.checkersStartup.ready(); }
 void ensureGuest();
 document.addEventListener('visibilitychange',visibilityChange);
 scene.events.on('update',update);
 scene.events.once('shutdown',()=>{
  gates.cancel();audio.dispose();play.onclick=null;
  ivory?.removeEventListener('click', pickWhite);
  ebony?.removeEventListener('click', pickBlack);
  if(window.checkersStartup.playIntent===invoke) window.checkersStartup.playIntent=null;
  scene.events.off('update',update);
  document.removeEventListener('visibilitychange',visibilityChange);
  root.inert=false;root.classList.remove('is-departing');paint(0);
 });
 return {
  layout: (_width:number,_height:number)=>undefined,
  /** After playfieldReady is wired: consume early «Играть» tap and auto-start. */
  flushPendingPlay:()=>{
   if(!window.checkersStartup.pendingPlay && !window.checkersStartup.playCommitted) return;
   // Honest progress until auto-start; waitPlay before clearing pending so show cannot idle.
   window.checkersStartup.waitPlay();
   window.checkersStartup.pendingPlay=false;
   invoke();
  },
  show:()=>{
   audio.show();
   gates.cancel();sampledAt=null;paint(0);root.inert=false;root.classList.remove('is-departing');
   window.checkersFlavor?.setState('loading');
   // Treat playCommitted like pending — never clear committed / unlock to calm «Играть».
   if(window.checkersStartup.pendingPlay || window.checkersStartup.playCommitted) window.checkersStartup.waitPlay();
   else window.checkersStartup.unlock();
   root.hidden=false;document.getElementById('game')!.inert=true;
   paintSide('white');
   if(!firstShow)play.focus({preventScroll:true});firstShow=false;
  },
  hide,
  setSearch,
  clearSearch,
  depart:(done:()=>void)=>{
   audio.depart();
   closeDialogs();root.inert=true;play.disabled=true;root.classList.add('is-departing');
   sampledAt=scene.time.now;
   gates.start(()=>{paint(preparationMs);hide(true);done();});
   paint(0);
  },
  beginMatch:()=>audio.beginMatch(),
  humanSide:()=>side,
  hintWave:()=>audio.hintWave(),
  arenaVoice:(humanSide:'white'|'black'='white')=>audio.arenaVoice(humanSide),
  speakOrcTurn:(name:string,humanSide:'white'|'black'='white')=>audio.speakOrcTurn(name,humanSide),
  revealAudio:(ms:number,reduced:boolean)=>audio.reveal(ms,reduced),
 };
}
