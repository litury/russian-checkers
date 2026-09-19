import Phaser from 'phaser';
import {
	pieceSprites,
} from '@/client/config/layout';
import { palette } from '@/client/config/palette';
import type { IBoardView } from '@/client/modules/board';
import { createBoardView } from '@/client/modules/board';
import { preloadKingFire } from '@/client/modules/board/kingFireAssets';
import { installDisplayDensity, logicalSize } from './displayDensity';
import { preparationMs } from './panelReveal';
import { orcOpeningTurnLine } from './orcTurn';
import { defeatTauntCue, pieceSelectSfx } from './pieceSfx';
import { recordBotMatch, probeApi, type CloudPly } from '@/online/cloud';
import { openLive, type NetMove } from '@/online/live';
import { classifyPly, hashPosition, positionFromSnapshot, takeNextPly } from '@/online/matchState';
import { FOUND_HOLD_MS, SEARCH_TIMEOUT_MS, type SearchPhase } from './matchmakingSearch';
import { orcOutcomeLine, orcTimeLow } from './orcResult';
import { StepwiseMove } from './stepwiseMove';
import { pickBotMove } from '@/client/modules/bot';
import { sameSquare } from '@/client/shared/sameSquare';
import { capturedOnSegment } from '@/rules/parts/capturedOnPath';
import type { IMove, IPosition, ISquare, Side } from '@/rules';
import {
	afterMoveBank,
	apply,
	blitzStartMs,

	createInitialPosition,
	legalMoves,
	remainingMs,
	resultSide,
	winner,
} from '@/rules';
import { createHud, matchStatus } from './createHud';
import { preloadBunkerPanels } from './bunkerPanel';
import { remainingForHud } from './matchClock';
import { createOpeningOverlay } from './openingOverlay';
import type { IYandexSdk } from './IYandexSdk';
import { getAutoMove, getBotSkill } from './settings';
import { canUndoBot } from './botUndo';
import { createResultOverlay } from './resultOverlay';
import mascotIdle0Url from './ui/result/mascot_idle_00.webp';
import mascotIdle1Url from './ui/result/mascot_idle_01.webp';
import mascotIdle2Url from './ui/result/mascot_idle_02.webp';
import mascotIdle3Url from './ui/result/mascot_idle_03.webp';
import mascotWin0Url from './ui/result/mascot_win_00.webp';
import mascotWin1Url from './ui/result/mascot_win_01.webp';
import mascotWin2Url from './ui/result/mascot_win_02.webp';
import mascotWin3Url from './ui/result/mascot_win_03.webp';
import mascotWin4Url from './ui/result/mascot_win_04.webp';
import resultBtnUrl from './ui/result/result_btn.webp';
import resultGlassWinUrl from './ui/result/result_glass_win.webp';
import resultMonitorUrl from './ui/result/result_monitor.webp';
import defeatTerminalUrl from './ui/result/terminal_sockets.webp';
import primaryRestUrl from './ui/result/primary_rest.webp';
import primaryPressedUrl from './ui/result/primary_pressed.webp';
import secondaryRestUrl from './ui/result/secondary_rest.webp';
import secondaryPressedUrl from './ui/result/secondary_pressed.webp';

export class GameScene extends Phaser.Scene {
	// Bot plays the opposite of the opening disk pick (default white).
	private humanSide: Side = 'white';
	private board?: IBoardView;
	private hud?: ReturnType<typeof createHud>;
	private overlay?: ReturnType<typeof createResultOverlay>;
	private title!: ReturnType<typeof createOpeningOverlay>;
	private sdk!: IYandexSdk;
	private position: IPosition = createInitialPosition();
	private selected: ISquare | null = null;
	private humanChain: StepwiseMove | null = null;
	private phase: 'title' | 'human' | 'bot' | 'over' = 'title';
	private paused = false;
	private pendingBot = false;
	private moving = false;
	private elapsedMs = 0;
	private runningSince = 0;
	private clocks = { white: blitzStartMs, black: blitzStartMs };
	private clockStartedAt = 0;
	private flagLock = false;

	private countingIn = false;
	private timeLowSaid = false;
	private matchPlies: CloudPly[] = [];
	private posKeys: string[] = [];
	private botUndoStack: { position: IPosition; clocks: { white: number; black: number }; plies: CloudPly[]; keys: string[] }[] = [];
	private online = false;
	private live: ReturnType<typeof openLive> | null = null;
	private searchPhase: SearchPhase = 'idle';
	private friendJoin = '';
	private searchStartedAt = 0;
	private searchTimer?: Phaser.Time.TimerEvent;
	private foundHold?: Phaser.Time.TimerEvent;
	private lastPly = 0;
	private serverTurn: Side = 'white';
	private onlineBegun = false;
	private inboundNet: NetMove[] = [];
	private applyingNet = false;

	private botTimer?: Phaser.Time.TimerEvent;

	constructor() {
		super({ key: 'GameScene' });
	}

	private startupFailed = false;
	private playfieldBuilt = false;
	private startingFromOpening = false;
	/** Settled by bootPlayfield; created before overlay so await never sees undefined. */
	private settlePlayfieldReady!: () => void;
	private playfieldReady: Promise<void> = new Promise((resolve) => {
		this.settlePlayfieldReady = resolve;
	});
	private resultReady!: Promise<void>;
	private interactiveReady!: Promise<void>;

	preload(): void {
		this.startupFailed = false;
		// Title is HTML-first: do not queue heavy packs here — unlock must not wait on them.
		window.checkersStartup?.status('Подключаем игру…');
		this.load.on('loaderror', () => {
			this.startupFailed = true;
			clearTimeout(window.checkersStartup?.watchdog);
			window.checkersStartup?.fail('Не удалось загрузить игровые ресурсы. Проверьте соединение и повторите загрузку.');
		});
	}

	create(): void {
		if (this.startupFailed) {
			this.settlePlayfieldReady();
			return;
		}
		this.sdk = (this.registry.get('sdk') as IYandexSdk | undefined) ?? {
			isStub: true,
			ready: () => undefined,
			showFullscreenAdv: (handlers) => {
				handlers.onClose?.(false);
			},
			onPause: () => undefined,
			onResume: () => undefined,
		};
		this.cameras.main.setBackgroundColor(palette.background);
		// Deferred exists from field init; boot board+pieces ASAP — before overlay/pending invoke.
		void this.bootPlayfield().then(
			() => this.settlePlayfieldReady(),
			() => this.settlePlayfieldReady(),
		);
		// Selection-v2: background after playfieldReady; gates board *reveal*, not HTML unlock.
		this.interactiveReady = this.bootMatchInteractive();
		// KingFire then result: after interactive (single Phaser loader); never gate reveal/depart.
		this.resultReady = this.interactiveReady.then(async () => {
			await this.bootKingFire();
			await this.bootResultPack();
		});
		this.title = createOpeningOverlay(this, {
			isPaused: () => this.paused,
			onPlayBot: () => {
				this.online = false;
				this.humanSide = this.title.humanSide();
				void this.requestStartFromOpening();
			},
			onPlayOnline: () => {
				this.beginSearchUi('online-hub');
			},
			onSearchFind: () => {
				void this.requestOnline();
			},
			onFriendCreate: () => {
				void this.requestOnline('host');
			},
			onFriendEnter: () => {
				this.beginSearchUi('friend-enter');
			},
			onFriendJoin: (code) => {
				const digits = code.replace(/\D/g, '').slice(0, 6);
				if (!/^\d{6}$/.test(digits) || digits === '000000') {
					this.searchPhase = 'friend-miss';
					this.paintSearch();
					return;
				}
				void this.requestOnline('join', digits);
			},
			onSearchCancel: () => this.cancelSearch(),
			onSearchStay: () => this.stayInSearch(),
			onSearchBot: () => this.searchPlayBot(),
		});
		document.getElementById('match-undo')?.addEventListener('click', () => this.undoBot());
		this.sdk.onPause(() => {
			this.setPaused(true);
		});
		this.sdk.onResume(() => {
			this.setPaused(false);
		});
		installDisplayDensity(this, (width, height) => this.layout(width, height));
		this.time.addEvent({
			delay: 100,
			loop: true,
			callback: () => {
				this.tickClock();
			},
		});
		this.title.layout(logicalSize(this).width, logicalSize(this).height);
		this.title.show();
		{
			const join = new URLSearchParams(location.search).get('join');
			if (join) void this.requestOnline('join', join);
		}
		// One-tap: early «Играть» before Phaser must auto-start once assets are wired.
		this.title.flushPendingPlay();
		this.sdk.ready();
	}

	private flushLoader(): Promise<void> {
		return new Promise((resolve) => {
			if (this.startupFailed) {
				resolve();
				return;
			}
			if (!this.load.isLoading() && this.load.list.size === 0) {
				resolve();
				return;
			}
			this.load.once('complete', () => resolve());
			if (!this.load.isLoading()) this.load.start();
		});
	}

	private queueTitleCritical(): void {
		// Share exact lossless delivery copies with the HTML opening; runtime delivers WebP; PNG masters archived under asset-compress/originals.
		const reliquaryAssets: Record<string, unknown> = {
			...import.meta.glob(['../modules/board/reliquary/*.webp', '!../modules/board/reliquary/black_disk.webp', '!../modules/board/reliquary/ivory_disk.webp'], { eager: true, query: '?url', import: 'default' }),
			'../modules/board/reliquary/black_disk.webp': new URL('./ui/opening/black_disk.webp', import.meta.url).href,
			'../modules/board/reliquary/ivory_disk.webp': new URL('./ui/opening/ivory_disk.webp', import.meta.url).href,
		};
		for (const [path, url] of Object.entries(reliquaryAssets)) {
			const name = path.split('/').pop()!.replace('.webp', '');
			this.load.image(`reliquary_${name}`, url as string);
		}
		this.load.image(pieceSprites.manLight, reliquaryAssets['../modules/board/reliquary/ivory_disk.webp'] as string);
		this.load.image(pieceSprites.manDark, reliquaryAssets['../modules/board/reliquary/black_disk.webp'] as string);
		this.load.image(pieceSprites.kingLight, reliquaryAssets['../modules/board/reliquary/ivory_king.webp'] as string);
		this.load.image(pieceSprites.kingDark, reliquaryAssets['../modules/board/reliquary/black_king.webp'] as string);
	}

	private queueMatchInteractive(): void {
		// Selection-v2 frames + seal: required before playfield reveal (hitboxes/origin).
		const selectionFrames = import.meta.glob('../modules/board/selection-v2/frames/*/*.webp', {
			eager: true, query: '?url', import: 'default',
		});
		for (const [path, url] of Object.entries(selectionFrames)) {
			this.load.image(`selection_${path.split('/').pop()!.replace('.webp', '')}`, url as string);
		}
		this.load.image('selection_king-seal', new URL('../modules/board/selection/markers/king-seal-proposed.webp', import.meta.url).href);
	}

	private queueKingFire(): void {
		// KingFire polish: heavy; lazy after interactiveReady — do not gate countdown/reveal.
		preloadKingFire(this);
	}

	private queueResultPack(): void {
		this.load.image('defeatTerminal', defeatTerminalUrl);
		this.load.image('defeat_primary_rest', primaryRestUrl);
		this.load.image('defeat_primary_pressed', primaryPressedUrl);
		this.load.image('defeat_secondary_rest', secondaryRestUrl);
		this.load.image('defeat_secondary_pressed', secondaryPressedUrl);
		const defeatFrames = import.meta.glob('./ui/result/checker-defeat/*.webp', {
			eager: true, query: '?url', import: 'default',
		});
		for (const [path, url] of Object.entries(defeatFrames)) {
			const frame = path.split('/').pop()!.replace('.webp', '');
			this.load.image(`checkerDefeat_${frame}`, url as string);
		}
		this.load.image('resultMonitor', resultMonitorUrl);
		this.load.image('mascotIdle0', mascotIdle0Url);
		this.load.image('mascotIdle1', mascotIdle1Url);
		this.load.image('mascotIdle2', mascotIdle2Url);
		this.load.image('mascotIdle3', mascotIdle3Url);
		this.load.image('resultGlassWin', resultGlassWinUrl);
		this.load.image('resultBtn', resultBtnUrl);
		this.load.image('mascotWin0', mascotWin0Url);
		this.load.image('mascotWin1', mascotWin1Url);
		this.load.image('mascotWin2', mascotWin2Url);
		this.load.image('mascotWin3', mascotWin3Url);
		this.load.image('mascotWin4', mascotWin4Url);
	}

	private async bootPlayfield(): Promise<void> {
		if (this.startupFailed) return;
		window.checkersStartup?.status('Загружаем доску и шашки…');
		// Minimal pack to show board and accept first move; outside preload so HTML unlock is free.
		this.queueTitleCritical();
		// Bunker HUD faces are small and needed at depart — keep on critical path.
		preloadBunkerPanels(this);
		await this.flushLoader();
		if (this.startupFailed) return;
		this.buildPlayfield();
	}

	private async bootMatchInteractive(): Promise<void> {
		if (this.startupFailed) return;
		await this.playfieldReady;
		if (this.startupFailed || !this.playfieldBuilt) return;
		this.queueMatchInteractive();
		await this.flushLoader();
		if (this.startupFailed) return;
		for (const key of this.textures.getTextureKeys()) {
			if (!key.startsWith('selection_')) continue;
			this.textures.get(key)?.setFilter(Phaser.Textures.FilterMode.LINEAR);
		}
		// No mid-match disk→v2 refresh: reveal waits on interactiveReady.
	}

	private async bootKingFire(): Promise<void> {
		if (this.startupFailed || !this.playfieldBuilt) return;
		this.queueKingFire();
		await this.flushLoader();
		if (this.startupFailed) return;
		for (const key of this.textures.getTextureKeys()) {
			if (!key.startsWith('king-fire_')) continue;
			this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
		}
	}

	private async bootResultPack(): Promise<void> {
		if (this.startupFailed || !this.playfieldBuilt) return;
		this.queueResultPack();
		await this.flushLoader();
		if (this.startupFailed) return;
		for (const key of [
			'resultMonitor',
			'mascotIdle0',
			'mascotIdle1',
			'mascotIdle2',
			'mascotIdle3',
		]) {
			if (!this.textures.exists(key)) continue;
			this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
		}
		if (!this.overlay) {
			this.overlay = createResultOverlay(this, {
				onPlayAgain: () => {
					void this.startMatch();
				},
				onMenu: () => {
					this.showTitle();
				},
			});
			this.overlay.layout(logicalSize(this).width, logicalSize(this).height);
		}
	}

	private buildPlayfield(): void {
		if (this.playfieldBuilt || this.startupFailed) return;
		this.hud = createHud(this, {
			onRevealProgress: (elapsed, reduced) => {
				this.board?.paintOpeningHint(elapsed / preparationMs, reduced);
				this.title?.revealAudio(elapsed, reduced);
			},
			isPaused: () => this.paused,
			onAutoChange: () => {
				this.refresh();
			},
		});
		this.hud.setVisible(false);
		this.board = createBoardView(this, (square) => {
			this.onSquare(square);
		}, () => this.cancelSelection(), () => this.hud!.isMenuOpen() || this.phase === 'over' || this.phase === 'title');
		this.board.setPlayfieldVisible(false);
		const { width, height } = logicalSize(this);
		this.board.layout(width, height);
		this.hud.layout(width, height);
		this.playfieldBuilt = true;
	}

	private paintSearch(): void {
		const seconds = Math.max(0, Math.floor((this.time.now - this.searchStartedAt) / 1000));
		this.title.setSearch(this.searchPhase, seconds, this.friendJoin);
	}

	private stopSearchTicker(): void {
		this.searchTimer?.remove(false);
		this.searchTimer = undefined;
		this.foundHold?.remove(false);
		this.foundHold = undefined;
	}

	private beginSearchUi(phase: SearchPhase = 'searching'): void {
		this.searchPhase = phase;
		this.searchStartedAt = this.time.now;
		this.paintSearch();
		this.searchTimer?.remove(false);
		this.searchTimer = this.time.addEvent({
			delay: 250,
			loop: true,
			callback: () => {
				if (this.searchPhase !== 'searching' && this.searchPhase !== 'waiting') return;
				this.paintSearch();
				if (this.time.now - this.searchStartedAt >= SEARCH_TIMEOUT_MS) {
					this.searchPhase = 'timeout-offer';
					this.stopSearchTicker();
					this.paintSearch();
				}
			},
		});
	}

	private cancelSearch(): void {
		this.live?.leave();
		this.live?.close();
		this.live = null;
		this.searchPhase = 'idle';
		this.friendJoin = '';
		this.stopSearchTicker();
		this.title.clearSearch();
		window.checkersStartup.unlock();
	}

	private markSearchOffline(): void {
		this.searchPhase = 'offline';
		this.stopSearchTicker();
		this.paintSearch();
		this.live?.close();
		this.live = null;
		this.time.delayedCall(1600, () => {
			if (this.searchPhase !== 'offline') return;
			this.searchPhase = 'idle';
			this.title.clearSearch();
			window.checkersStartup.unlock();
		});
	}

	private stayInSearch(): void {
		if (!this.live?.isOpen()) {
			this.markSearchOffline();
			return;
		}
		this.beginSearchUi('waiting');
	}

	private searchPlayBot(): void {
		this.live?.leave();
		this.live?.close();
		this.live = null;
		this.searchPhase = 'idle';
		this.stopSearchTicker();
		this.title.clearSearch();
		this.online = false;
		this.humanSide = this.title.humanSide();
		void this.requestStartFromOpening();
	}

	private async requestOnline(kind: 'queue' | 'host' | 'join' = 'queue', matchId = ''): Promise<void> {
		this.beginSearchUi(kind === 'queue' ? 'searching' : kind === 'host' ? 'friend-wait' : 'friend-enter');
		const healthy = await probeApi();
		if (!healthy) {
			this.markSearchOffline();
			return;
		}
		this.live?.close();
		this.live = openLive({
			onQueued: () => {
				if (this.searchPhase === 'timeout-offer') return;
				this.searchPhase = 'waiting';
				this.paintSearch();
			},
			onHosted: (_id, code) => {
				this.friendJoin = code && /^\d{6}$/.test(code) ? code : '';
				this.searchPhase = 'friend-wait';
				this.paintSearch();
				if (this.friendJoin) void navigator.clipboard?.writeText(this.friendJoin).catch(() => {});
			},
			onStart: (color, _matchId, snap) => {
				this.searchPhase = 'found';
				this.stopSearchTicker();
				this.paintSearch();
				this.online = true;
				this.humanSide = color;
				this.lastPly = snap.ply;
				this.serverTurn = snap.turn;
				this.onlineBegun = snap.begun;
				if (snap.pieces.length) this.position = positionFromSnapshot(snap);
				this.foundHold = this.time.delayedCall(FOUND_HOLD_MS, () => {
					this.title.clearSearch();
					void this.requestStartFromOpening();
				});
			},
			onBegin: (snap) => this.applyBegin(snap),
			onState: (snap) => this.applyState(snap),
			onMove: (move) => {
				if (this.phase === 'over') return;
				this.inboundNet.push(move);
				this.drainInbound();
			},
			onEnd: (winner, reason, youWin) => {
				if (this.phase === 'over') return;
				if (reason === 'timeout') {
					this.endMatch(this.humanSide);
					return;
				}
				if (reason === 'flag') {
					const side =
						youWin === true
							? this.humanSide
							: this.humanSide === 'white'
								? 'black'
								: 'white';
					this.endMatch(side, 'flag');
					return;
				}
				const side =
					youWin === true
						? this.humanSide
						: youWin === false
							? this.humanSide === 'white'
								? 'black'
								: 'white'
							: winner === 'draw'
								? this.humanSide
								: winner;
				this.endMatch(side);
			},
			onError: (error) => {
				if (error === 'illegal') {
					this.live?.requestState();
					return;
				}
				if (error === 'no_match') {
					this.searchPhase = 'friend-miss';
					this.paintSearch();
					return;
				}
				if (this.onlineBegun || this.phase !== 'title') return;
				if (error === 'busy' && this.live?.isOpen()) {
					this.searchPhase = 'waiting';
					this.paintSearch();
					return;
				}
				this.markSearchOffline();
			},
		});
		const ok = await this.live.connect();
		if (!ok) {
			this.markSearchOffline();
			return;
		}
		if (kind === 'host') this.live.host();
		else if (kind === 'join') this.live.join(matchId);
		else this.live.queue();
	}

	private applyBegin(snap: {ply: number; turn: Side; hash: string; pieces: {row: number; col: number; side: Side; kind: 'man' | 'king'}[]}): void {
		this.onlineBegun = true;
		this.lastPly = snap.ply;
		this.serverTurn = snap.turn;
		if (snap.pieces.length) this.position = positionFromSnapshot(snap);
		this.phase = this.serverTurn === this.humanSide ? 'human' : 'bot';
		if (this.countingIn) {
			this.clockStartedAt = this.time.now;
			this.countingIn = false;
		}
		this.paintClock();
		this.refresh();
		this.drainInbound();
	}

	private applyState(snap: {ply: number; turn: Side; hash: string; begun: boolean; pieces: {row: number; col: number; side: Side; kind: 'man' | 'king'}[]}): void {
		this.lastPly = snap.ply;
		this.serverTurn = snap.turn;
		this.onlineBegun = snap.begun;
		if (snap.pieces.length) this.position = positionFromSnapshot(snap);
		this.inboundNet = [];
		this.moving = false;
		this.humanChain = null;
		this.selected = null;
		this.phase = !snap.begun ? this.phase : this.serverTurn === this.humanSide ? 'human' : 'bot';
		this.refresh();
	}

	private drainInbound(): void {
		if (this.phase === 'over' || this.moving) return;
		if (this.inboundNet.some((m) => classifyPly(this.lastPly, m.ply) === 'gap')) {
			this.live?.requestState();
			return;
		}
		const next = takeNextPly(this.inboundNet, this.lastPly);
		if (!next) return;
		this.lastPly = next.ply;
		this.serverTurn = next.turn;
		this.applyingNet = true;
		if (next.side === this.humanSide && this.position.turn !== next.side) {
			this.applyingNet = false;
			this.phase = this.serverTurn === this.humanSide ? 'human' : 'bot';
			this.refresh();
			this.drainInbound();
			return;
		}
		if (next.side === this.humanSide) this.playHumanLocal(next);
		else this.playRemote(next);
	}

	private async requestStartFromOpening(): Promise<void> {
		if (this.phase !== 'title' || this.startingFromOpening) return;
		this.startingFromOpening = true;
		window.checkersStartup.pendingPlay = false;
		try {
			window.checkersStartup.waitPlay();
			await this.playfieldReady;
			// Hard fail: clear committed only; fail() owns the error UI — never calm unlock.
			if (this.startupFailed) {
				window.checkersStartup.playCommitted = false;
				return;
			}
			// Soft leave (no longer title): do not unlock idle «Играть».
			if (this.phase !== 'title') return;
			// If boot resolved without a playfield, rebuild and keep waiting on the promise.
			if (!this.playfieldBuilt) {
				window.checkersStartup.waitPlay();
				this.playfieldReady = this.bootPlayfield();
				this.interactiveReady = this.bootMatchInteractive();
				this.resultReady = this.interactiveReady.then(async () => {
					await this.bootKingFire();
					await this.bootResultPack();
				});
				await this.playfieldReady;
				if (this.startupFailed) {
					window.checkersStartup.playCommitted = false;
					return;
				}
				if (this.phase !== 'title') return;
				if (!this.playfieldBuilt) {
					window.checkersStartup.waitPlay();
					return;
				}
			}
			// Selection frames must be ready before board+timers appear — no disk flash.
			window.checkersStartup.waitPlay();
			await this.interactiveReady;
			if (this.startupFailed) {
				window.checkersStartup.playCommitted = false;
				return;
			}
			if (this.phase !== 'title') return;
			await this.startMatch(true);
			// startMatch no-op while still title: keep bars — committed cleared only by hide/depart or hard fail.
			if (this.phase === 'title') window.checkersStartup.waitPlay();
		} finally {
			this.startingFromOpening = false;
		}
	}

	private async ensureResultOverlay(): Promise<ReturnType<typeof createResultOverlay> | undefined> {
		await this.resultReady;
		return this.overlay;
	}

	private showTitle(): void {
		this.humanChain = null;
		this.botTimer?.remove(false);
		this.tweens.killAll();
		this.board?.reset();
		this.online = false;
		this.live?.close();
		this.live = null;
		this.onlineBegun = false;
		this.lastPly = 0;
		this.inboundNet = [];
		this.board?.setFacing('white');
		this.hud?.setFacing('white');
		this.moving = false;
		this.position = createInitialPosition();
		this.selected = null;
		this.phase = 'title';
		this.timeLowSaid = false;
		this.pendingBot = false;
		this.humanSide = 'white';
		this.overlay?.hide();
		this.hud?.setVisible(false);
		this.paintUndo();
		this.stopCountdown();
		this.board?.setPlayfieldVisible(false);
		this.title.show();
		this.refresh();
	}

	private async startMatch(fromOpening = false): Promise<void> {
		if (fromOpening && this.phase !== 'title') return;
		if (!this.playfieldBuilt || !this.board || !this.hud) return;
		// Gate reveal on selection-v2; kingFire stays off this wait.
		await this.interactiveReady;
		if (this.startupFailed) return;
		if (fromOpening && this.phase !== 'title') return;
		if (!this.playfieldBuilt || !this.board || !this.hud) return;
		this.stopCountdown();
		this.countingIn = true;
		this.humanChain = null;
		this.botTimer?.remove(false);
		this.tweens.killAll();
		this.board.reset();
		this.board.setFacing(this.humanSide);
		this.hud.setFacing(this.humanSide);
		this.moving = false;
		this.position = createInitialPosition();
		this.selected = null;
		this.phase = this.humanSide === 'black' ? 'bot' : 'human';
		this.timeLowSaid = false;
		this.pendingBot = false;
		this.elapsedMs = 0;
		this.runningSince = this.time.now;
		this.clocks = { white: blitzStartMs, black: blitzStartMs };
		this.clockStartedAt = 0;
		this.flagLock = false;
		this.matchPlies = [];
		this.posKeys = [hashPosition(this.position)];
		this.botUndoStack = [];
		this.lastPly = this.online ? this.lastPly : 0;
		this.inboundNet = [];

		this.hud.setClock(
			Math.ceil(blitzStartMs / 1000),
			Math.ceil(blitzStartMs / 1000),
		);
		if (!fromOpening) this.title.hide();
		this.overlay?.hide();
		this.hud.prepareClosed();
		this.hud.setVisible(true);
		this.hud.setNames('Ты', this.online ? 'Соперник' : 'Бот');
		// interactiveReady already settled: first paint is selection-v2 (disk only if boot failed).
		this.board.setPlayfieldVisible(true);
		this.beginCountdown(fromOpening);
		this.refresh();
	}

	private stopCountdown(): void {
		this.board?.clearOpeningHint();
		this.hud?.stopReveal();
		this.countingIn = false;
	}

	private beginCountdown(fromOpening = false): void {
		const board = this.board;
		const hud = this.hud;
		if (!board || !hud) return;
		this.stopCountdown();
		this.countingIn = true;
		const ready = () => {
			if (!this.countingIn) return;
			if (this.online && !this.onlineBegun) {
				this.live?.ready();
				this.refresh();
				return;
			}
			// The entire sequential opening has finished; start banks and input now.
			this.title.speakOrcTurn(orcOpeningTurnLine(this.humanSide), this.humanSide);
			this.clockStartedAt = this.time.now;
			this.countingIn = false;
			this.paintClock();
			this.refresh();
			if (this.phase === 'bot') {
				this.refresh();
				this.botTimer?.remove(false);
				this.botTimer = this.time.delayedCall(400, () => this.playBot());
			}
		};
		const startPanels = () => {
			if (!this.countingIn) return;
			this.title.beginMatch();
			board.startOpeningHint(this.position, this.humanSide);
			this.title.hintWave();
			hud.startReveal(ready);
			hud.setVisible(true);
		};
		if (fromOpening) this.title.depart(startPanels);
		else startPanels();
	}

	private layout(width: number, height: number): void {
		this.board?.layout(width, height);
		this.hud?.layout(width, height);
		this.overlay?.layout(width, height);
		this.title?.layout(width, height);
		if (this.playfieldBuilt) this.refresh();
	}

	private clockTurn(): Side {
		if (this.online && this.onlineBegun) {
			return this.onlineHumanTurn() ? this.humanSide : this.humanSide === 'white' ? 'black' : 'white';
		}
		return this.position.turn;
	}

	private sideRemainingMs(side: Side): number {
		return remainingForHud({
			countingIn: this.countingIn,
			phase: this.phase,
			bankMs: this.clocks[side],
			startedAt: this.clockStartedAt,
			now: this.time.now,
			paused: this.paused,
			side,
			turn: this.clockTurn(),
		});
	}

	private onlineHumanTurn(): boolean {
		return this.onlineBegun && this.serverTurn === this.humanSide && this.position.turn === this.humanSide;
	}

	private canSelect(): boolean {
		if (this.paused || this.moving || this.countingIn || this.flagLock || this.phase === 'over') return false;
		if (this.online) return this.onlineHumanTurn();
		return this.phase === 'human';
	}

	private paintClock(): void {
		this.hud?.setClock(
			Math.ceil(this.sideRemainingMs('white') / 1000),
			Math.ceil(this.sideRemainingMs('black') / 1000),
			this.countingIn || this.flagLock || this.phase === 'over' ? null : this.clockTurn(),
		);
	}

	private settleClock(mover: Side): void {
		const left = remainingMs(
			this.clocks[mover],
			this.clockStartedAt,
			this.time.now,
			this.paused,
		);
		this.clocks[mover] = afterMoveBank(left);
		this.clockStartedAt = this.time.now;
	}

	private tickClock(): void {
		if (this.phase === 'title') {
			return;
		}
		if (this.countingIn) {
			this.paintClock();
			return;
		}
		this.paintClock();
		if (
			this.paused ||
			this.moving ||
			this.flagLock ||
			this.countingIn ||
			this.phase === 'over'
		) {
			return;
		}
		const own = this.sideRemainingMs(this.humanSide);
		if (orcTimeLow(own, this.timeLowSaid) && this.clockTurn() === this.humanSide) {
			this.timeLowSaid = true;
			this.title?.speakOrcTurn('time-low', this.humanSide);
		}
		const side = this.clockTurn();
		const left = remainingMs(
			this.clocks[side],
			this.clockStartedAt,
			this.time.now,
			false,
		);
		if (left <= 0) {
			if (this.online && side !== this.humanSide) return;
			this.onFlag();
		}
	}

	private onFlag(): void {
		if (this.flagLock || this.moving || this.countingIn || this.phase === 'over') {
			return;
		}
		if (this.online) {
			this.flagLock = true;
			this.selected = null;
			this.humanChain = null;
			this.refresh();
			this.live?.flag();
			return;
		}
		this.flagLock = true;
		const loser = this.position.turn;
		const won = loser === 'white' ? 'black' : 'white';
		this.endMatch(won, 'flag');
	}

	private refresh(): void {
		if (this.phase === 'title') {
			this.hud?.setTurn('');
			return;
		}
		if (!this.board || !this.hud) return;
		this.board.sync(
			this.humanChain?.visualPosition ?? this.position,
			this.humanHighlights(),
			this.selected,
			this.optionMoves(),
			this.countingIn ? undefined :
				this.canSelect()
					? this.humanChain?.remainingRoutes ?? legalMoves(this.position) : [],
		);
		this.board.setWaitingIdle(
			!this.canSelect() && (this.phase === 'bot' || this.countingIn || this.paused || (this.online && !this.onlineBegun) || (this.online && !this.onlineHumanTurn())),
		);
		this.hud.setTurn(matchStatus(
			this.countingIn || (this.online && !this.onlineBegun),
			this.phase === 'over'
				? 'over'
				: this.online && this.onlineBegun
				? (this.onlineHumanTurn() ? 'human' : 'bot')
				: this.phase,
			legalMoves(this.position).some(move => move.path[0] && capturedOnSegment(this.position, move.from, move.path[0])), Boolean(this.humanChain)));
		this.maybeAutoMove();
		this.paintUndo();
	}

	private maybeAutoMove(): void {
		if (!this.canSelect()) {
			return;
		}
		if (!getAutoMove()) {
			return;
		}
		// A shared next square does not make multiple complete routes forced.
		if (this.humanChain) return;
		const moves = legalMoves(this.position);
		if (moves.length === 1) {
			this.playHuman(moves[0]);
		}
	}

	private optionMoves(): IMove[] {
		if (!this.canSelect()) {
			return [];
		}
		// Visual routes stay complete; humanHighlights/choose expose only the next hop.
		if (this.humanChain) return this.humanChain.remainingRoutes;
		return this.selected ? new StepwiseMove(this.position, this.selected).remainingRoutes : [];
	}

	private humanHighlights(): ISquare[] {
		if (!this.canSelect()) {
			return [];
		}
		const moves = legalMoves(this.position);
		const selected = this.selected;
		if (selected) {
			const chain = this.humanChain ?? new StepwiseMove(this.position, selected);
			return uniqueSquares(chain.clickable);
		}
		return uniqueSquares(moves.map((move) => move.from));
	}

	private onSquare(square: ISquare): void {
		if (
			this.paused ||
			this.moving ||
			this.flagLock ||
			this.countingIn ||
			this.phase === 'over' ||
			(this.online && !this.onlineBegun) ||
			!this.canSelect()
		) {
			return;
		}
		const moves = legalMoves(this.position);
		const selected = this.selected;
		if (selected) {
			if (this.playHumanHop(square)) {
				return;
			}
		}
		// A started capture is irrevocable, including clicks on other own pieces.
		if (this.humanChain) return;
		if (moves.some((move) => sameSquare(move.from, square))) {
			this.selected = square;
			this.refresh();
			pieceSelectSfx(this.position.squares[square.row][square.col]?.side ?? 'black');
			return;
		}
		const piece = this.position.squares[square.row][square.col];
		const denied = Boolean(piece && piece.side === this.position.turn);
		this.selected = null;
		this.refresh();
		if (denied) {
			this.board?.deny(square);
		}
	}

	private cancelSelection(): void {
		if (this.phase !== 'human' || this.paused || this.moving || this.countingIn || this.humanChain) return;
		this.selected = null;
		this.refresh();
	}

	private playHumanHop(square: ISquare): boolean {
		if (!this.selected) return false;
		if (this.online && this.sideRemainingMs(this.position.turn) <= 0) {
			this.onFlag();
			return false;
		}
		const chain = this.humanChain ?? new StepwiseMove(this.position, this.selected);

		const chosen = chain.choose(square);
		if (!chosen) return false;
		this.humanChain = chain;
		this.moving = true;

		this.board?.playMove(chosen.hop, () => {
			this.moving = false;
			this.selected = chain.selected;
			// Time runs through hops and branch decisions; a final tap cannot rescue a flag.
			if (this.sideRemainingMs(this.position.turn) <= 0) {
				this.onFlag();
				return;
			}
			if (chosen.complete) {
				if (this.online) {
					this.live?.move(chosen.complete);
					this.drainInbound();
				}
				else this.completeHumanMove(chosen.complete);
			}
			else this.refresh();
		}, undefined, undefined, true);
		return true;
	}

	private animateMove(move: IMove, after: () => void): void {
		this.moving = true;
		this.selected = null;

		this.board?.playMove(
			move,
			() => {
				this.moving = false;
				after();
				this.drainInbound();
			},
		);
	}

	private paintUndo(): void {
		const el = document.getElementById('match-undo') as HTMLButtonElement | null;
		if (!el) return;
		const on = canUndoBot(this.online, this.botUndoStack.length) && this.phase !== 'title';
		el.hidden = !on;
	}

	private undoBot(): void {
		if (this.online) return;
		if (!canUndoBot(this.online, this.botUndoStack.length)) return;
		const snap = this.botUndoStack.pop();
		if (!snap) return;
		this.botTimer?.remove(false);
		this.moving = false;
		this.position = snap.position;
		this.clocks = { ...snap.clocks };
		this.matchPlies = snap.plies.slice();
		this.posKeys = snap.keys.slice();
		this.selected = null;
		this.humanChain = null;
		this.flagLock = false;
		this.overlay?.hide();
		this.phase = this.position.turn === this.humanSide ? 'human' : 'bot';
		this.clockStartedAt = this.time.now;
		this.refresh();
		if (this.phase === 'bot') this.botTimer = this.time.delayedCall(400, () => this.playBot());
	}

	private playHuman(move: IMove): void {
		if (!this.online) {
			this.botUndoStack.push({
				position: structuredClone(this.position),
				clocks: { ...this.clocks },
				plies: this.matchPlies.slice(),
				keys: this.posKeys.slice(),
			});
		}
		this.animateMove(move, () => {
			if (this.online) this.live?.move(move);
			else this.completeHumanMove(move);
		});
	}

	private completeHumanMove(move: IMove): void {
		const mover = this.position.turn;
		const next = apply(this.position, move);
		if (!next) return;
		this.settleClock(mover);
		this.matchPlies.push({ side: mover, from: move.from, path: move.path });
		this.position = next;
		this.humanChain = null;
		this.selected = null;
		this.board?.notePly();
		this.posKeys.push(hashPosition(this.position));
		const outcome = resultSide(this.position, this.posKeys);
		if (outcome === 'draw') {
			this.phase = 'over';
			this.refresh();
			if (!this.online) void recordBotMatch({ humanSide: this.humanSide, winner: 'draw', plies: this.matchPlies });
			return;
		}
		if (outcome) {
			this.endMatch(outcome);
			return;
		}
		this.phase = this.online
			? (this.onlineHumanTurn() ? 'human' : 'bot')
			: this.position.turn === this.humanSide ? 'human' : 'bot';
		this.refresh();
		if (this.online) {
			if (!this.applyingNet && mover === this.humanSide) this.lastPly += 1;
			this.applyingNet = false;
			this.drainInbound();
			return;
		}
		this.botTimer?.remove(false);
		this.botTimer = this.time.delayedCall(400, () => this.playBot());
	}

	private playRemote(move: IMove): void {
		this.animateMove(move, () => this.completeHumanMove(move));
	}

	private playHumanLocal(move: IMove): void {
		this.completeHumanMove(move);
	}

	private playBot(): void {
		if (this.online) return;
		if (this.paused) {
			this.pendingBot = true;
			return;
		}
		if (this.phase !== 'bot' || this.moving) {
			return;
		}
		this.pendingBot = false;
		const move = pickBotMove(this.position, Math.random, getBotSkill());
		if (!move) {
			this.endMatch(winner(this.position) ?? 'white');
			return;
		}
		this.animateMove(move, () => {
			const mover = this.position.turn;
			const next = apply(this.position, move);
			if (!next) {
				this.endMatch(winner(this.position) ?? 'white');
				return;
			}
			this.settleClock(mover);
			this.matchPlies.push({ side: mover, from: move.from, path: move.path });
			this.position = next;
			this.posKeys.push(hashPosition(this.position));
			const outcome = resultSide(this.position, this.posKeys);
			if (outcome === 'draw') {
				this.phase = 'over';
				this.refresh();
				void recordBotMatch({ humanSide: this.humanSide, winner: 'draw', plies: this.matchPlies });
				return;
			}
			if (outcome) {
				this.endMatch(outcome);
				return;
			}
			this.phase = 'human';
			this.refresh();
		});
	}

	resignMatch(): void {
		if (this.paused || this.moving || this.flagLock || this.phase !== 'human' || !this.board) {
			return;
		}
		this.board.reset();
		this.phase = 'over';
		this.selected = null;
		this.refresh();
		this.title?.resultSting(false, defeatTauntCue(this.humanSide), this.humanSide);
		void recordBotMatch({
			humanSide: this.humanSide,
			winner: this.humanSide === 'white' ? 'black' : 'white',
			plies: this.matchPlies,
		});
		void this.ensureResultOverlay().then((overlay) => overlay?.show('black', this.humanSide));
		this.board.clearOpeningHint();
	}

	private endMatch(side: Side, kind: 'flag' | 'rules' = 'rules'): void {
		if (!this.board) return;
		this.board.reset();
		this.moving = false;
		this.botTimer?.remove(false);
		this.board.clearOpeningHint();
		this.phase = 'over';
		this.selected = null;
		this.refresh();
		{
			const line = orcOutcomeLine(kind, side === this.humanSide);
			if (line === 'time-up') this.title?.speakOrcTurn(line, this.humanSide);
			else this.title?.resultSting(line === 'victory', line === 'victory' ? line : defeatTauntCue(this.humanSide), this.humanSide);
		}
		if (!this.online) {
		void recordBotMatch({
			humanSide: this.humanSide,
			winner: side,
			plies: this.matchPlies,
		});
		}
		const show = () => {
			void this.ensureResultOverlay().then((overlay) => overlay?.show(side, this.humanSide));
		};
		this.sdk.showFullscreenAdv({
			onClose: show,
			onError: show,
		});
	}

	private setPaused(paused: boolean): void {
		if (paused === this.paused) {
			return;
		}
		if (paused && !this.countingIn && (this.phase === 'human' || this.phase === 'bot')) {
			const side = this.position.turn;
			this.clocks[side] = remainingMs(
				this.clocks[side],
				this.clockStartedAt,
				this.time.now,
				false,
			);
			this.elapsedMs += this.time.now - this.runningSince;
		} else {
			this.runningSince = this.time.now;
			this.clockStartedAt = this.time.now;
		}
		this.paused = paused;
		if (paused) {
			this.tweens.pauseAll();
		} else {
			this.tweens.resumeAll();
		}
		if (!paused && this.pendingBot) {
			this.playBot();
		}
	}
}

function uniqueSquares(squares: ISquare[]): ISquare[] {
	const seen = new Set<string>();
	const unique: ISquare[] = [];
	for (const square of squares) {
		const key = `${square.row},${square.col}`;
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		unique.push(square);
	}
	return unique;
}
