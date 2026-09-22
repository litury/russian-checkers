import { animateSiegeGates } from './siegeGateTransition';
import { setSiegeSide, siegeSide } from './siegeSelection';
import type Phaser from 'phaser';
import {createMenuAudio} from './menuAudio';
import {bindMatchHistory} from './matchHistoryUi';
import {ensureGuest, loadColorStats, loadPresence, beatPresence} from '@/online/cloud';
import {colorStatLabel} from '@/online/colorStats';
import {guestTag} from '@/online/guestTag';
import {presenceLit, HEARTBEAT_MS, PRESENCE_CACHE_MS} from '@/online/presence';
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
 const whiteGuest = document.getElementById('opening-guest-white');
 const blackGuest = document.getElementById('opening-guest-black');
 let side: 'white' | 'black' = siegeSide(root);
 const paintGuest = () => {
  void ensureGuest().then((g) => {
   const tag = g ? guestTag(g.id) : '';
   const showW = side === 'white' && !!tag;
   const showB = side === 'black' && !!tag;
   if (whiteGuest) { whiteGuest.hidden = !showW; whiteGuest.textContent = showW ? tag : ''; }
   if (blackGuest) { blackGuest.hidden = !showB; blackGuest.textContent = showB ? tag : ''; }
  }).catch(() => {
   if (whiteGuest) whiteGuest.hidden = true;
   if (blackGuest) blackGuest.hidden = true;
  });
 };
 const paintSide = (next: 'white' | 'black') => {
  side = next;
  setSiegeSide(root, next);
  paintGuest();
 };
 paintSide(siegeSide(root));
 const pick = (next: 'white' | 'black') => (event: Event) => {
  event.preventDefault();
  event.stopPropagation();
  if (root.hidden || gates.active || root.inert) return;
  paintSide(next);
 };
 const sideChanged = () => { side = siegeSide(root); paintGuest(); };
 root.addEventListener('siege-side', sideChanged);
 const retry = document.getElementById('opening-retry')!;
 const motion = matchMedia('(prefers-reduced-motion: reduce)');
 const gates = new OpeningGates();
 const audio=createMenuAudio(scene.registry.get('sdk'));
 let firstShow = true;
 let visual: ReturnType<typeof animateSiegeGates> = null;
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
 clearSearch();
  audio.hide(completed,motion.matches);
  gates.cancel(); closeDialogs(); root.hidden=true; root.inert=false;
  cancelVisual();
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
 const invoke = () => {
  // Allow invoke while waitPlay disabled the button (early click / residual load).
  if(root.hidden||gates.active||root.inert) return;
  handlers.onPlayBot();
 };
 const pickWhite = pick('white');
 const pickBlack = pick('black');
 play.onclick=()=>invoke();
 if (online) online.onclick=()=>{ if(root.hidden||root.inert) return; handlers.onPlayOnline?.(); };
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
 const whiteStat = document.getElementById('opening-color-white');
 const blackStat = document.getElementById('opening-color-black');
 const paintColorStats = () => {
  void loadColorStats().then((stats) => {
   if (whiteStat) whiteStat.textContent = colorStatLabel(stats, 'white');
   if (blackStat) blackStat.textContent = colorStatLabel(stats, 'black');
  }).catch(() => {
   if (whiteStat) whiteStat.textContent = '';
   if (blackStat) blackStat.textContent = '';
  });
 };
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
   liveCount.textContent = on ? String(n) : '';
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
  root.removeEventListener('siege-side', sideChanged);
  ivory?.removeEventListener('click', pickWhite);
  ebony?.removeEventListener('click', pickBlack);
  if(window.checkersStartup.playIntent===invoke) window.checkersStartup.playIntent=null;
  scene.events.off('update',update);
  scene.events.off('pause',pauseScene);
  scene.events.off('resume',resumeScene);
  motion.removeEventListener?.('change',motionChange);
  document.removeEventListener('visibilitychange',visibilityChange);
  document.removeEventListener('pagehide', pageHide);
  root.inert=false;root.classList.remove('is-departing');cancelVisual();
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
   gates.cancel();cancelVisual();root.inert=false;root.classList.remove('is-departing');
   window.checkersFlavor?.setState('loading');
   // Treat playCommitted like pending — never clear committed / unlock to calm «Играть».
   if(window.checkersStartup.pendingPlay || window.checkersStartup.playCommitted) window.checkersStartup.waitPlay();
   else window.checkersStartup.unlock();
   root.hidden=false;document.getElementById('game')!.inert=true;
   paintSide(siegeSide(root));
   if(!firstShow)play.focus({preventScroll:true});firstShow=false;
   paintColorStats();
   startPresence();
  },
  hide,
  setSearch,
  clearSearch,
  depart:(done:()=>void)=>{
   if (root.hidden || gates.active || root.inert) return;
   audio.depart();
   closeDialogs();root.inert=true;play.disabled=true;root.classList.add('is-departing');
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
  revealAudio:(ms:number,reduced:boolean)=>audio.reveal(ms,reduced),
 };
}
