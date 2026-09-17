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
import { pieceSelectSfx } from './pieceSfx';
import { recordBotMatch, probeApi, type CloudPly } from '@/online/cloud';
import { openLive } from '@/online/live';
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
	winner,
} from '@/rules';
import { createHud, matchStatus } from './createHud';
import { preloadBunkerPanels } from './bunkerPanel';
import { remainingForHud } from './matchClock';
import { createOpeningOverlay } from './openingOverlay';
import type { IYandexSdk } from './IYandexSdk';
import { getAutoMove } from './settings';
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
	private online = false;
	private live: ReturnType<typeof openLive> | null = null;
	private searchPhase: SearchPhase = 'idle';
	private searchStartedAt = 0;
	private searchTimer?: Phaser.Time.TimerEvent;
	private foundHold?: Phaser.Time.TimerEvent;

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
				void this.requestOnline();
			},
			onSearchCancel: () => this.cancelSearch(),
			onSearchStay: () => this.stayInSearch(),
			onSearchBot: () => this.searchPlayBot(),
		});
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
		this.title.setSearch(this.searchPhase, seconds);
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

	private async requestOnline(): Promise<void> {
		this.beginSearchUi('searching');
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
			onStart: (color) => {
				this.searchPhase = 'found';
				this.stopSearchTicker();
				this.paintSearch();
				this.online = true;
				this.humanSide = color;
				this.foundHold = this.time.delayedCall(FOUND_HOLD_MS, () => {
					this.title.clearSearch();
					void this.requestStartFromOpening();
				});
			},
			onMove: (move, side) => {
				if (this.phase === 'over' || this.moving) return;
				if (side === this.humanSide) this.playHumanLocal(move);
				else this.playRemote(move);
			},
			onEnd: (winner, reason, youWin) => {
				if (this.phase === 'over') return;
				if (reason === 'timeout') {
					this.endMatch(this.humanSide);
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
		this.live.queue();
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
			// The entire sequential opening has finished; start banks and input now.
			this.clockStartedAt = this.time.now;
			this.countingIn = false;
			this.paintClock();
			this.refresh();
			this.title.speakOrcTurn(orcOpeningTurnLine(this.humanSide), this.humanSide);
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
			this.title.arenaVoice(this.humanSide);
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

	private sideRemainingMs(side: Side): number {
		return remainingForHud({
			countingIn: this.countingIn,
			phase: this.phase,
			bankMs: this.clocks[side],
			startedAt: this.clockStartedAt,
			now: this.time.now,
			paused: this.paused,
			side,
			turn: this.position.turn,
		});
	}

	private paintClock(): void {
		this.hud?.setClock(
			Math.ceil(this.sideRemainingMs('white') / 1000),
			Math.ceil(this.sideRemainingMs('black') / 1000),
			this.countingIn || this.phase === 'over' ? null : this.position.turn,
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
		if (orcTimeLow(own, this.timeLowSaid)) {
			this.timeLowSaid = true;
			this.title?.speakOrcTurn('time-low', this.humanSide);
		}
		const side = this.position.turn;
		const left = remainingMs(
			this.clocks[side],
			this.clockStartedAt,
			this.time.now,
			false,
		);
		if (left <= 0) {
			this.onFlag();
		}
	}

	private onFlag(): void {
		if (this.online) return;
		if (this.flagLock || this.moving || this.countingIn || this.phase === 'over') {
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
				this.phase === 'human' && this.position.turn === this.humanSide && !this.moving
					? this.humanChain?.remainingRoutes ?? legalMoves(this.position) : [],
		);
		this.board.setWaitingIdle(
			this.phase === 'bot' || this.countingIn || this.paused,
		);
		this.hud.setTurn(matchStatus(this.countingIn, this.phase,
			legalMoves(this.position).some(move => move.path[0] && capturedOnSegment(this.position, move.from, move.path[0])), Boolean(this.humanChain)));
		this.maybeAutoMove();
	}

	private maybeAutoMove(): void {
		if (
			this.paused ||
			this.moving ||
			this.flagLock ||
			this.countingIn ||
			this.phase !== 'human'
		) {
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
		if (this.phase !== 'human' || this.paused || this.countingIn) {
			return [];
		}
		// Visual routes stay complete; humanHighlights/choose expose only the next hop.
		if (this.humanChain) return this.humanChain.remainingRoutes;
		return this.selected ? new StepwiseMove(this.position, this.selected).remainingRoutes : [];
	}

	private humanHighlights(): ISquare[] {
		if (this.phase !== 'human' || this.paused || this.countingIn) {
			return [];
		}
		const moves = legalMoves(this.position);
		const selected = this.selected;
		if (selected) {
			return uniqueSquares(this.optionMoves().map(move => move.path[0]));
		}
		return uniqueSquares(moves.map((move) => move.from));
	}

	private onSquare(square: ISquare): void {
		if (
			this.paused ||
			this.moving ||
			this.flagLock ||
			this.countingIn ||
			this.phase !== 'human'
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
			const same = selected && sameSquare(selected, square);
			this.selected = square;
			this.refresh();
			if (!same) pieceSelectSfx();
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
				if (this.online) this.live?.move(chosen.complete);
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
			},
		);
	}

	private playHuman(move: IMove): void {
		this.animateMove(move, () => this.completeHumanMove(move));
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
		const side = winner(this.position);
		if (side) {
			this.endMatch(side);
			return;
		}
		this.phase = this.position.turn === this.humanSide ? 'human' : 'bot';
		this.refresh();
		if (this.online) return;
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
		const move = pickBotMove(this.position);
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
			const side = winner(this.position);
			if (side) {
				this.endMatch(side);
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
		this.title?.speakOrcTurn(orcOutcomeLine('resign', false), this.humanSide);
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
		this.title?.speakOrcTurn(orcOutcomeLine(kind, side === this.humanSide), this.humanSide);
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
