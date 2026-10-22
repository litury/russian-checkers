import {
	animateMenuDeparture,
	MenuTransition,
	menuDepartureMs,
	repeatMenuDepartureMs,
} from './menuTransition';
import { setSiegeSide, siegeSide } from './siegeSelection';
import type Phaser from 'phaser';
import { createMenuAudio } from '../../audio/menuAudio';
import { uiSfx } from '../../audio/uiSfx';
import { playMenu } from './menuNavigation';
import { loadPresence, beatPresence } from '@/client/platform/network/cloud';

import { HEARTBEAT_MS } from '@/client/platform/network/presencePolicy';
import { notePlayIntent, playIntentEvent } from './playIntent';
import { type SearchPhase } from '../match/online/matchmakingSearch';

import type {} from './startupContract';

/** HTML-first controls survive asset failures; the board behind them is real Phaser. */
export function createOpeningOverlay(
	scene: Phaser.Scene,
	handlers: {
		onPlayBot: () => void;
		onPlayOnline?: () => void;
		onSearchFind?: () => void;
		onFriendCreate?: () => void;
		onFriendEnter?: () => void;
		onFriendJoin?: (code: string) => void;
		onSearchCancel?: () => void;
		isPaused?: () => boolean;
	},
) {
	const root = document.getElementById('opening')!;
	const play = document.getElementById('opening-play') as HTMLButtonElement;
	const online = document.getElementById(
		'opening-online',
	) as HTMLButtonElement | null;
	let liveTotal: number | null = null;
	const renderLive = () => playMenu.setCount(liveTotal);
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
	const gates = new MenuTransition();
	let departures = 0;
	const audio = createMenuAudio(scene.registry.get('sdk'));
	let firstShow = true;
	let visual: ReturnType<typeof animateMenuDeparture> = null;
	let frozenScroll: number | null = null;
	const holdScroll = () => {
		if (frozenScroll !== null) root.scrollTop = frozenScroll;
	};
	const releaseScroll = () => {
		frozenScroll = null;
	};
	const blockScroll = (event: Event) => {
		if (frozenScroll !== null) event.preventDefault();
	};
	window.addEventListener?.('resize', holdScroll);
	root.addEventListener('wheel', blockScroll, { passive: false });
	root.addEventListener('touchmove', blockScroll, { passive: false });
	let scenePaused = false;
	const cancelVisual = () => {
		visual?.cancel();
		visual = null;
	};
	const syncPause = () =>
		visual?.pause(document.hidden || scenePaused || !!handlers.isPaused?.());
	const pauseScene = () => {
		scenePaused = true;
		syncPause();
	};
	const resumeScene = () => {
		scenePaused = false;
		syncPause();
	};
	const motionChange = () => {
		if (motion.matches && gates.active) {
			audio.gate(menuDepartureMs, true);
			gates.advance(menuDepartureMs);
		}
	};
	const closeDialogs = () => {
		for (const id of [
			'opening-modes-dialog',
			'match-history',
		]) {
			const dialog = document.getElementById(id) as HTMLDialogElement;
			if (dialog.open) dialog.close();
		}
	};
	const hide = (completed = false) => {
		if (completed) window.checkersFlavor?.setState('ready');
		window.checkersStartup.playCommitted = false;
		window.checkersStartup.pendingPlay = false;
		window.checkersStartup.pendingOnline = false;
		window.checkersStartup.playIntentAt = null;
		window.checkersStartup.onlineIntentAt = null;
		clearSearch();
		audio.hide(completed, motion.matches);
		gates.cancel();
		closeDialogs();
		root.hidden = true;
		root.inert = false;
		cancelVisual();
		releaseScroll();
		root.classList.remove('is-departing');
		document.getElementById('game')!.inert = false;
		scene.game.canvas.focus({ preventScroll: true });
	};
	const visibilityChange = () => {
		syncPause();
		if (document.hidden) {
			stopBeat();
			leavePresence();
		} else startBeat();
	};
	const pageHide = () => {
		stopBeat();
		leavePresence();
	};
	const update = () => {
		syncPause();
		if (
			!gates.active ||
			document.hidden ||
			scenePaused ||
			handlers.isPaused?.()
		)
			return;
		const elapsed = motion.matches
			? gates.duration
			: (visual?.elapsed ?? gates.duration);
		// Sound windows stay on the canonical gate timeline, so a compressed repeat
		// keeps its cues aligned instead of cutting them off.
		audio.gate((elapsed * menuDepartureMs) / gates.duration, motion.matches);
		gates.advance(elapsed - gates.elapsed);
	};
	const invoke = (event?: Event) => {
		// Allow invoke while waitPlay disabled the button (early click / residual load).
		if (root.hidden || gates.active || root.inert) return;
		notePlayIntent(event);
		window.checkersStartup.source = 'play';
		handlers.onPlayBot();
	};
	const pickWhite = pick('white');
	const pickBlack = pick('black');
	play.onclick = (event) => invoke(event);
	const invokeOnline = (event?: Event) => {
		if (root.hidden || root.inert) return;
		notePlayIntent(event);
		window.checkersStartup.source = 'online';
		window.checkersStartup.pendingOnline = false;
		handlers.onPlayOnline?.();
	};
	window.checkersStartup.onlineIntent = invokeOnline;
	if (online) online.onclick = (event) => invokeOnline(event);
	const controls = new AbortController();
	const options = { signal: controls.signal };
	document.getElementById('opening-search-find')!.addEventListener(
		'click',
		() => {
			handlers.onSearchFind?.();
			uiSfx('ui-tap');
		},
		options,
	);
	document.getElementById('opening-search-create')!.addEventListener(
		'click',
		() => {
			handlers.onFriendCreate?.();
			uiSfx('ui-tap');
		},
		options,
	);
	document.getElementById('opening-search-enter')!.addEventListener(
		'click',
		() => {
			handlers.onFriendEnter?.();
			uiSfx('ui-tap');
		},
		options,
	);
	document.getElementById('opening-friend-form')!.addEventListener(
		'submit',
		(event) => {
			event.preventDefault();
			handlers.onFriendJoin?.(
				(
					document.getElementById('opening-friend-code') as HTMLInputElement
				).value.trim(),
			);
		},
		options,
	);
	const setSearch = (phase: SearchPhase, seconds: number, join = '') => {
		const view = playMenu.setSearch(phase, seconds, join);
		root.classList.toggle('is-searching', view.hidePlay);
		if (view.title) window.checkersStartup.status(view.title);
		else window.checkersStartup.ready();
		if (!view.hidePlay) {
			window.checkersStartup.idlePlay?.();
			window.checkersStartup.idleOnline?.();
		}
	};
	const clearSearch = () => setSearch('idle', 0);
	playMenu.setOnlineReady(true);
	const cancelForNavigation = () => {
		if (!root.hidden && !root.inert) handlers.onSearchCancel?.();
	};
	root.addEventListener('opening-navigation-back', cancelForNavigation);
	ivory?.addEventListener('click', pickWhite);
	ebony?.addEventListener('click', pickBlack);
	window.checkersStartup.playIntent = invoke;
	clearTimeout(window.checkersStartup.watchdog);
	retry.hidden = true;
	play.hidden = false;
	// Keep pending/committed until invoke/auto-start so show()/unlock cannot idle the button.
	if (
		window.checkersStartup.pendingPlay ||
		window.checkersStartup.playCommitted
	)
		window.checkersStartup.waitPlay();
	else {
		window.checkersStartup.unlock();
		window.checkersStartup.ready();
	}
	let beatTimer: number | undefined;
	let presenceEpoch = 0;
	let presenceActive = false;
	let presenceAbort: AbortController | undefined;
	// A leave is a mutation, not an abortable read. A returning lifecycle must
	// wait for it; otherwise the old off can erase the newer on at the server.
	let pendingLeave: Promise<unknown> | undefined;
	const leavePresence = () => {
		pendingLeave = (pendingLeave ?? Promise.resolve())
			.then(() => beatPresence(false))
			.catch(() => undefined);
	};
	const showLive = (live: number | null) => {
		liveTotal = live;
		renderLive();
	};
	const stopBeat = () => {
		presenceAbort?.abort();
		presenceAbort = undefined;
		presenceActive = false;
		presenceEpoch++;
		if (beatTimer !== undefined) window.clearTimeout(beatTimer);
		beatTimer = undefined;
	};
	const startBeat = () => {
		if (document.hidden || presenceActive) return;
		presenceActive = true;
		presenceAbort = new AbortController();
		const lifecycleSignal = presenceAbort.signal;
		const epoch = presenceEpoch;
		const poll = async () => {
			if (pendingLeave) await pendingLeave;
			if (epoch !== presenceEpoch || lifecycleSignal.aborted || document.hidden)
				return;
			const signal = AbortSignal.any([
				lifecycleSignal,
				AbortSignal.timeout(12_000),
			]);
			let live: number | null = null;
			try {
				live = await beatPresence(true, signal);
				if (live === null && !signal.aborted) live = await loadPresence(signal);
			} catch {
				/* unavailable, not zero */
			}
			if (epoch !== presenceEpoch || document.hidden) return;
			showLive(live);
			beatTimer = window.setTimeout(() => {
				void poll();
			}, HEARTBEAT_MS);
		};
		void poll();
	};
	const startPresence = startBeat;
	startPresence();
	document.addEventListener('visibilitychange', visibilityChange);
	window.addEventListener('pagehide', pageHide);
	window.addEventListener('pageshow', startBeat);
	scene.events.on('update', update);
	scene.events.on('pause', pauseScene);
	scene.events.on('resume', resumeScene);
	motion.addEventListener?.('change', motionChange);
	scene.events.once('shutdown', () => {
		controls.abort();
		playMenu.setOnlineReady(false);
		root.removeEventListener('opening-navigation-back', cancelForNavigation);
		stopBeat();
		leavePresence();
		gates.cancel();
		audio.dispose();
		play.onclick = null;
		if (online) online.onclick = null;
		ivory?.removeEventListener('click', pickWhite);
		ebony?.removeEventListener('click', pickBlack);
		if (window.checkersStartup.playIntent === invoke)
			window.checkersStartup.playIntent = null;
		if (window.checkersStartup.onlineIntent === invokeOnline)
			window.checkersStartup.onlineIntent = null;
		scene.events.off('update', update);
		scene.events.off('pause', pauseScene);
		scene.events.off('resume', resumeScene);
		motion.removeEventListener?.('change', motionChange);
		document.removeEventListener('visibilitychange', visibilityChange);
		window.removeEventListener('pagehide', pageHide);
		window.removeEventListener('pageshow', startBeat);
		window.removeEventListener?.('resize', holdScroll);
		root.inert = false;
		releaseScroll();
		root.classList.remove('is-departing');
		cancelVisual();
	});
	return {
		layout: (_width: number, _height: number) => undefined,
		/** After playfieldReady is wired: consume early «Играть» tap and auto-start. */
		flushPendingPlay: () => {
			if (
				!window.checkersStartup.pendingPlay &&
				!window.checkersStartup.playCommitted
			)
				return;
			// The press may predate the engine: replay its instant so play-intent is the tap.
			const stamp = window.checkersStartup.playIntentAt;
			window.checkersStartup.playIntentAt = null;
			// Honest progress until auto-start; waitPlay before clearing pending so show cannot idle.
			window.checkersStartup.waitPlay();
			window.checkersStartup.pendingPlay = false;
			invoke(playIntentEvent(stamp));
		},
		flushPendingOnline: () => {
			if (!window.checkersStartup.pendingOnline) return;
			const stamp = window.checkersStartup.onlineIntentAt;
			window.checkersStartup.onlineIntentAt = null;
			invokeOnline(playIntentEvent(stamp));
		},
		show: () => {
			audio.show();
			if (
				!firstShow &&
				!window.checkersStartup.pendingPlay &&
				!window.checkersStartup.playCommitted &&
				!window.checkersStartup.pendingOnline
			)
				root.dispatchEvent(new Event('opening-main-menu'));
			gates.cancel();
			cancelVisual();
			root.inert = false;
			releaseScroll();
			root.classList.remove('is-departing');
			window.checkersFlavor?.setState('loading');
			// Treat playCommitted like pending — never clear committed / unlock to calm «Играть».
			if (
				window.checkersStartup.pendingPlay ||
				window.checkersStartup.playCommitted
			)
				window.checkersStartup.waitPlay();
			else window.checkersStartup.unlock();
			root.hidden = false;
			document.getElementById('game')!.inert = true;
			paintSide(siegeSide(root));
			if (!firstShow)
				document
					.getElementById('opening-start')
					?.focus({ preventScroll: true });
			firstShow = false;
			startPresence();
		},
		hide,
		setSearch,
		clearSearch,
		depart: (done: () => void) => {
			if (root.hidden || gates.active || root.inert) return;
			audio.depart();
			closeDialogs();
			root.inert = true;
			play.disabled = true;
			frozenScroll = root.scrollTop;
			root.classList.add('is-departing');
			// Loading is finished; the following time belongs to the approved gate motion.
			const activeButton =
				window.checkersStartup.source === 'online' ? online : play;
			const activeLabel = activeButton?.querySelector('.opening-cta-label');
			if (activeLabel) activeLabel.textContent = 'Начинаем…';
			activeButton?.setAttribute('aria-busy', 'false');
			root.scrollTop = frozenScroll;
			// Atlas art is always visible; its network/decode state never gates departure.
			if (motion.matches) {
				hide(true);
				done();
				return;
			}
			// The first arrival keeps the full approved choreography; later matches
			// compress the same pass. Input never waits on it, but the wait is shorter.
			gates.duration =
				departures++ === 0 ? menuDepartureMs : repeatMenuDepartureMs;
			visual = animateMenuDeparture(root, gates.duration);
			if (!visual) {
				hide(true);
				done();
				return;
			}
			gates.start(() => {
				hide(true);
				done();
			});
			syncPause();
			audio.gate(0, false);
		},
		beginMatch: () => audio.beginMatch(),
		humanSide: () => siegeSide(root),
		turnHandoff: () => audio.turnHandoff(),
		hintWave: () => audio.hintWave(),
		arenaVoice: (humanSide: 'white' | 'black' = 'white') =>
			audio.arenaVoice(humanSide),
		speakOrcTurn: (name: string, humanSide: 'white' | 'black' = 'white') =>
			audio.speakOrcTurn(name, humanSide),
		resultSting: (
			win: boolean,
			line: string,
			humanSide: 'white' | 'black' = 'white',
		) => audio.resultSting(win, line, humanSide),
		revealAudio: (ms: number, reduced: boolean) => audio.reveal(ms, reduced),
		warmAudio: () => audio.warmAudio(),
	};
}
