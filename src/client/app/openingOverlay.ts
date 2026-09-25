import { animateSiegeGates } from './siegeGateTransition';
import { setSiegeSide, siegeSide } from './siegeSelection';
import type Phaser from 'phaser';
import {createMenuAudio} from './menuAudio';
import {bindMatchHistory} from './matchHistoryUi';
import {ensureGuest, loadPresence, beatPresence} from '@/online/cloud';

import {presenceLit, HEARTBEAT_MS, PRESENCE_CACHE_MS} from '@/online/presence';
import {markPerf,markPerfAt} from './perfMarks';
import {OpeningGates} from './openingGates';
import {gateDurationMs as preparationMs} from './openingGates';
import {searchCopy, type SearchPhase} from './matchmakingSearch';

declare global {
 interface Window {
  checkersFlavor?: { setState: (next: string) => void };
  checkersStartup: {
   watchdog: number;
   pendingPlay?: boolean;
   playCommitted?: boolean;
   playIntent?: ((event?: Event) => void) | null;
   onlineIntent?: ((event?: Event) => void) | null;
   pendingOnline?: boolean;
   source?: 'play' | 'online';
   fail: (message: string) => void;
   unlock: () => void;
   waitPlay: () => void;
   waitOnline?: () => void;
   idlePlay?: () => void;
   idleOnline?: () => void;
   ready: () => void;
   status: (message: string) => void;
  };
 }
}

/** HTML-first controls survive asset failures; the board behind them is real Phaser. */
export function createOpeningOverlay(scene: Phaser.Scene, handlers: {
 onPlayBot: () => void;
 onPlayOnline?: () => void;
 onSearchFind?: () => void;
 onFriendCreate?: () => void;
 onFriendEnter?: () => void;
 onFriendJoin?: (code: string) => void;
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
 const paintSide = (next: 'white' | 'black') => {
  setSiegeSide(root, next);

 };
 paintSide(siegeSide(root));
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
 let firstShow = true;
 let visual: ReturnType<typeof animateSiegeGates> = null;
 let frozenScroll: number | null = null;
 const holdScroll = () => { if (frozenScroll !== null) root.scrollTop = frozenScroll; };
 const releaseScroll = () => { frozenScroll = null; };
 const blockScroll = (event: Event) => { if (frozenScroll !== null) event.preventDefault(); };
 window.addEventListener?.('resize', holdScroll);
 root.addEventListener('wheel', blockScroll, {passive: false});
 root.addEventListener('touchmove', blockScroll, {passive: false});
 let scenePaused = false;
 const cancelVisual = () => { visual?.cancel(); visual=null; };
 const syncPause = () => visual?.pause(document.hidden || scenePaused || !!handlers.isPaused?.());
 const pauseScene = () => { scenePaused=true; syncPause(); };
 const resumeScene = () => { scenePaused=false; syncPause(); };
 const motionChange = () => {
  if (motion.matches && gates.active) { audio.gate(preparationMs,true); gates.advance(preparationMs); }
 };
 const closeDialogs = () => {
  for (const id of ['opening-options-dialog','opening-help-dialog','opening-settings-dialog']) {
   const dialog=document.getElementById(id) as HTMLDialogElement;
   if(dialog.open) dialog.close();
  }
 };
 const hide = (completed=false) => {
 if (completed) window.checkersFlavor?.setState('ready');
 window.checkersStartup.playCommitted=false;
 window.checkersStartup.pendingPlay=false;
 window.checkersStartup.pendingOnline=false;
 clearSearch();
  audio.hide(completed,motion.matches);
  gates.cancel(); closeDialogs(); root.hidden=true; root.inert=false;
  cancelVisual();
  releaseScroll();
  root.classList.remove('is-departing');
  document.getElementById('game')!.inert=false;
  scene.game.canvas.focus({preventScroll:true});
 };
 const visibilityChange = () => {
  syncPause();
  if (document.hidden) { void beatPresence(false); stopBeat(); }
  else startBeat();
 };
 const pageHide = () => { void beatPresence(false); stopBeat(); };
 const update = () => {
  syncPause();
  if(!gates.active || document.hidden || scenePaused || handlers.isPaused?.()) return;
  const elapsed = motion.matches ? preparationMs : visual?.elapsed ?? preparationMs;
  audio.gate(elapsed,motion.matches);
  gates.advance(elapsed - gates.elapsed);
 };
 const notePlayIntent = (event?: Event) => {
  // A busy main thread must not hide the wait: use the click's own timestamp.
  const stamp = event && Number.isFinite(event.timeStamp) ? event.timeStamp : performance.now();
  markPerfAt('play-intent', stamp);
  markPerf('play-handled');
 };
 const invoke = (event?: Event) => {
  // Allow invoke while waitPlay disabled the button (early click / residual load).
  if(root.hidden||gates.active||root.inert) return;
  notePlayIntent(event);
  window.checkersStartup.source = 'play';
  handlers.onPlayBot();
 };
 const pickWhite = pick('white');
 const pickBlack = pick('black');
 play.onclick=(event)=>invoke(event);
 const invokeOnline = (event?: Event) => {
  if(root.hidden||root.inert) return;
  notePlayIntent(event);
  window.checkersStartup.source = 'online';
  window.checkersStartup.pendingOnline = false;
  handlers.onPlayOnline?.();
 };
 window.checkersStartup.onlineIntent = invokeOnline;
 if (online) online.onclick=(event)=>invokeOnline(event);
 const searchFind = document.getElementById('opening-search-find') as HTMLButtonElement | null;
 const searchCreate = document.getElementById('opening-search-create') as HTMLButtonElement | null;
 const searchEnter = document.getElementById('opening-search-enter') as HTMLButtonElement | null;
 const searchGo = document.getElementById('opening-search-go') as HTMLButtonElement | null;
 const friendCode = document.getElementById('opening-friend-code') as HTMLInputElement | null;
 searchCancel?.addEventListener('click', () => handlers.onSearchCancel?.());
 searchFind?.addEventListener('click', () => handlers.onSearchFind?.());
 searchCreate?.addEventListener('click', () => handlers.onFriendCreate?.());
 searchEnter?.addEventListener('click', () => handlers.onFriendEnter?.());
 searchGo?.addEventListener('click', () => handlers.onFriendJoin?.(friendCode?.value.trim() ?? ''));
 searchStay?.addEventListener('click', () => handlers.onSearchStay?.());
 searchBot?.addEventListener('click', () => handlers.onSearchBot?.());
 const setSearch = (phase: SearchPhase, seconds: number, join = '') => {
  const view = searchCopy(phase, seconds, join);
  if (!search || !searchCopyEl) return;
  const on = phase !== 'idle';
  search.hidden = !on;
  root.classList.toggle('is-searching', view.hidePlay);
  searchCopyEl.textContent = view.title;
  if (searchCancel) searchCancel.hidden = !view.showCancel;
  if (searchStay) searchStay.hidden = !view.showStay;
  if (searchBot) searchBot.hidden = !view.showBot;
  if (searchFind) searchFind.hidden = !view.showFind;
  if (searchCreate) searchCreate.hidden = !view.showCreate;
  if (searchEnter) searchEnter.hidden = !view.showEnter;
  if (friendCode) friendCode.hidden = !view.showCode;
  if (searchGo) searchGo.hidden = !view.showCode;
  if (view.title) window.checkersStartup.status(view.title);
  else window.checkersStartup.ready();
  if (!view.hidePlay) {
   window.checkersStartup.idlePlay?.();
   window.checkersStartup.idleOnline?.();
  }
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
 const liveDot = document.getElementById('opening-live-dot');
 const liveCount = document.getElementById('opening-live-count');
 let presenceTimer: number | undefined;
 let beatTimer: number | undefined;
 const showLive = (live: number | null) => {
  const n = live ?? 0;
  const on = presenceLit(n);
  online?.classList.toggle('is-live', on);
  if (liveDot) liveDot.hidden = !on;
  if (liveCount) {
   liveCount.hidden = !on;
   liveCount.textContent = on ? `Онлайн: ${n}` : '';
  }
 };
 const paintPresence = () => {
  void loadPresence().then(showLive).catch(() => showLive(0));
 };
 const stopBeat = () => {
  if (beatTimer !== undefined) window.clearInterval(beatTimer);
  beatTimer = undefined;
  if (presenceTimer !== undefined) window.clearInterval(presenceTimer);
  presenceTimer = undefined;
 };
 const startBeat = () => {
  stopBeat();
  if (document.hidden) return;
  void beatPresence(true).then(showLive);
  beatTimer = window.setInterval(() => { void beatPresence(true).then(showLive); }, HEARTBEAT_MS);
  presenceTimer = window.setInterval(paintPresence, PRESENCE_CACHE_MS);
 };
 const startPresence = startBeat;
 bindMatchHistory();
 document.addEventListener('visibilitychange',visibilityChange);
 document.addEventListener('pagehide', pageHide);
 scene.events.on('update',update);
 scene.events.on('pause',pauseScene);
 scene.events.on('resume',resumeScene);
 motion.addEventListener?.('change',motionChange);
 scene.events.once('shutdown',()=>{
 stopBeat();
  void beatPresence(false);
  gates.cancel();audio.dispose();play.onclick=null;
  if (online) online.onclick=null;
  ivory?.removeEventListener('click', pickWhite);
  ebony?.removeEventListener('click', pickBlack);
  if(window.checkersStartup.playIntent===invoke) window.checkersStartup.playIntent=null;
  if(window.checkersStartup.onlineIntent===invokeOnline) window.checkersStartup.onlineIntent=null;
  scene.events.off('update',update);
  scene.events.off('pause',pauseScene);
  scene.events.off('resume',resumeScene);
  motion.removeEventListener?.('change',motionChange);
  document.removeEventListener('visibilitychange',visibilityChange);
  document.removeEventListener('pagehide', pageHide);
  window.removeEventListener?.('resize', holdScroll);
  root.inert=false;releaseScroll();root.classList.remove('is-departing');cancelVisual();
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
  flushPendingOnline:()=>{
   if(!window.checkersStartup.pendingOnline) return;
   invokeOnline();
  },
  show:()=>{
   audio.show();
   gates.cancel();cancelVisual();root.inert=false;releaseScroll();root.classList.remove('is-departing');
   window.checkersFlavor?.setState('loading');
   // Treat playCommitted like pending — never clear committed / unlock to calm «Играть».
   if(window.checkersStartup.pendingPlay || window.checkersStartup.playCommitted) window.checkersStartup.waitPlay();
   else window.checkersStartup.unlock();
   root.hidden=false;document.getElementById('game')!.inert=true;
   paintSide(siegeSide(root));
   if(!firstShow)play.focus({preventScroll:true});firstShow=false;
   startPresence();
  },
  hide,
  setSearch,
  clearSearch,
  depart:(done:()=>void)=>{
   if (root.hidden || gates.active || root.inert) return;
   audio.depart();
   closeDialogs();root.inert=true;play.disabled=true;
   frozenScroll = root.scrollTop;
   root.classList.add('is-departing');
   root.scrollTop = frozenScroll;
   // Decoration failure cannot block a ready game; normal decoded art always slides.
   const leaves = [...root.querySelectorAll<HTMLImageElement>('.siege-left,.siege-right')];
   const artReady = leaves.length === 2 && leaves.every(image => image.classList.contains('is-decoded'));
   if (motion.matches || !artReady) { hide(true); done(); return; }
   visual=animateSiegeGates(root);
   if (!visual) { hide(true); done(); return; }
   gates.start(()=>{hide(true);done();});
   syncPause();
   audio.gate(0,false);
  },
  beginMatch:()=>audio.beginMatch(),
  humanSide:()=>siegeSide(root),
  turnHandoff:()=>audio.turnHandoff(),
  hintWave:()=>audio.hintWave(),
  arenaVoice:(humanSide:'white'|'black'='white')=>audio.arenaVoice(humanSide),
  speakOrcTurn:(name:string,humanSide:'white'|'black'='white')=>audio.speakOrcTurn(name,humanSide),
  resultSting:(win:boolean,line:string,humanSide:'white'|'black'='white')=>audio.resultSting(win,line,humanSide),
  resultCeremonySound:(win:boolean)=>audio.resultCeremonySound(win),
  stopResultCeremonySound:()=>audio.stopResultCeremonySound(),
  revealAudio:(ms:number,reduced:boolean)=>audio.reveal(ms,reduced),
 };
}
