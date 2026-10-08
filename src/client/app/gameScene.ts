import { bindResignConfirmation } from './resignConfirmation';
import Phaser from 'phaser';
import { warmMatchActionArt } from './matchActionArtWarmup';
import {loadImage} from './assetLoader';
import {boardDelivery} from './boardDelivery';
import {
	pieceSprites,
} from '@/client/config/layout';
import { palette } from '@/client/config/palette';
import type { IBoardView } from '@/client/modules/board';
import { createBoardView } from '@/client/modules/board';
import { preloadKingFire } from '@/client/modules/board/kingFireAssets';
import {
	selectionOverlayTexture,
	type SelectionOverlayFrame,
} from '@/client/modules/board/selectionOverlay';
import { installDisplayDensity, logicalSize } from './displayDensity';
import { preparationMs } from './panelReveal';
import { orcOpeningTurnLine } from './orcTurn';
import { defeatTauntCue, pieceSelectSfx } from './pieceSfx';
import { recordBotMatch, probeApi, type CloudPly } from '@/online/cloud';
import { openLive, type NetMove } from '@/online/live';
import { classifyPly, hashPosition, positionFromSnapshot, takeNextPly, type MatchSnapshot } from '@/online/matchState';
import { FOUND_HOLD_MS, SEARCH_TIMEOUT_MS, type SearchPhase } from './matchmakingSearch';
import { orcOutcomeLine, orcTimeLow } from './orcResult';
import { StepwiseMove } from './stepwiseMove';
import { haptics, moveHapticKinds, type HapticKind } from './haptics';
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
import { markPerf } from './perfMarks';
import { optionalPack, warmImages } from './idleWork';
import { dropNoticeLine } from './dropNotice';
import { preloadBunkerPanels } from './bunkerPanel';
import { remainingForHud } from './matchClock';
import { createOpeningOverlay } from './openingOverlay';
import type { IYandexSdk } from './IYandexSdk';
import { getAutoMove, getBotSkill } from './settings';
import { canUndoBot } from './botUndo';
import { createResultOverlay, type Verdict } from './boardVerdict';
import { verdictReason } from './verdictReason';


export class GameScene extends Phaser.Scene {
	// Bot plays the opposite of the opening disk pick (default white).
	private humanSide: Side = 'white';
	private board?: IBoardView;
	private hud?: ReturnType<typeof createHud>;
	private overlay?: ReturnType<typeof createResultOverlay>;
	private resultGen = 0;
	private acceptedResult: Verdict | null = null;
	private resultPresented = false;
	private botUndoGen = 0;
	private restoringBotUndo = false;
	private title!: ReturnType<typeof createOpeningOverlay>;
	private sdk!: IYandexSdk;
	private position: IPosition = createInitialPosition();
	private selected: ISquare | null = null;
	private humanChain: StepwiseMove | null = null;
	private pendingHaptic: { move: IMove; kind: HapticKind; ply: number } | null = null;
	private phase: 'title' | 'human' | 'bot' | 'over' = 'title';
	private paused = false;
	private pendingBot = false;
	private moving = false;
	private elapsedMs = 0;
	private runningSince = 0;
	private clocks = { white: blitzStartMs, black: blitzStartMs };
	private clockStartedAt = 0;
	private flagLock = false;
	private remoteClockPaused = false;
	private dropUntil = 0;
	private dropServerNow = 0;
	private dropReceivedAt = 0;

	/**
	 * Reveal readiness of the board, shared with the HUD. The rail is a match
	 * control: it must not be on screen before the playfield it belongs to.
	 * `playfieldReadyDone` is the pack gate, `boardPainted` the first painted
	 * frame of the revealed board (same seam the perf timeline reads).
	 */
	private playfieldReadyDone = false;
	private boardPainted = false;
	private actionsEntered = false;
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
	/** Pending first-frame listener; kept so shutdown can remove it. */
	private boardFrameListener?: () => void;

	private botTimer?: Phaser.Time.TimerEvent;

	constructor() {
		super({ key: 'GameScene' });
	}

	private startupFailed = false;
	private playfieldBuilt = false;
	/**
	 * Decoration packs warm up lazily and may be missing (aborted/blocked lazy
	 * import): the match stays playable, this is only a diagnostic surface for
	 * the browser QA seam.
	 */
	readonly missingDecoration = { selectionOverlay: false, kingFire: false };
	private startingFromOpening = false;
	/** Settled by bootPlayfield; created before overlay so await never sees undefined. */
	private settlePlayfieldReady!: () => void;
	private playfieldReady: Promise<void> = new Promise((resolve) => {
		this.settlePlayfieldReady = resolve;
	});
	private resultReady!: Promise<ReturnType<typeof createResultOverlay> | undefined>;
	private interactiveReady!: Promise<void>;
	private endpointWarmUp = false;
	private stopWarmUp?: () => void;

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
			() => {
				if (!this.startupFailed) this.playfieldReadyDone = true;
				this.settlePlayfieldReady();
			},
			() => this.settlePlayfieldReady(),
		);
		// Selection-v2: background after playfieldReady; gates board *reveal*, not HTML unlock.
		this.interactiveReady = this.bootMatchInteractive();
		void this.interactiveReady.then(() => {
			if (this.startupFailed || this.phase === 'title' || !this.playfieldBuilt) return;
			this.refresh();
		});
		// KingFire polish, the win/lose window and the result pack are separate branches off the
		// reveal: a short bot match must never wait for the whole king-fire chain.
		this.scheduleResultWindow();
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
		this.bindUndoButton();
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
		void this.seatResume();
		{
			const join = new URLSearchParams(location.search).get('join');
			if (join) void this.requestOnline('join', join);
		}
		// One-tap: early «Играть» before Phaser must auto-start once assets are wired.
		this.title.flushPendingPlay();
		this.title.flushPendingOnline();
		this.sdk.ready();
		if (import.meta.env.DEV) {
			// Browser QA seam: drive a real match without synthetic board taps.
			(window as unknown as { __checkersScene?: GameScene }).__checkersScene = this;
		}
	}

	/**
	 * Off the board reveal: king-fire polish, then the window itself (its own DOM art only
	 * starts downloading once the overlay exists), then the Phaser result pack in idle.
	 * Nothing here gates the window: it paints from its own art, and the pack is warmed
	 * long before the first possible final of a short bot match.
	 */
	private scheduleResultWindow(): void {
		void this.interactiveReady.then(async () => {
			// Small overlay pack first: the board can then show selection at once.
			// Both packs are decoration, and each owns its own failure: a rejected
			// lazy import of the overlay must not become an unhandled rejection and
			// must not cancel the king-fire warm-up queued behind it.
			const markOverlayUnavailable = (): void => {
				this.missingDecoration.selectionOverlay = true;
			};
			await optionalPack(
				'selection-overlay',
				() => this.bootSelectionOverlay(),
				markOverlayUnavailable,
			);
			await optionalPack('king-fire', () => this.bootKingFire(), () => {
				this.missingDecoration.kingFire = true;
			});
		});
		this.resultReady = this.playfieldReady.then(() => this.ensureOverlay());
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

	private async queueTitleCritical(): Promise<void> {
		// Share exact lossless delivery copies with the HTML opening; runtime delivers WebP; PNG masters archived under asset-compress/originals.
		const reliquaryAssets: Record<string, unknown> = {
			...import.meta.glob(['../modules/board/reliquary/*.webp', '!../modules/board/reliquary/black_disk.webp', '!../modules/board/reliquary/ivory_disk.webp'], { eager: true, query: '?url', import: 'default' }),
			'../modules/board/reliquary/black_disk.webp': new URL('./ui/opening/black_disk.webp', import.meta.url).href,
			'../modules/board/reliquary/ivory_disk.webp': new URL('./ui/opening/ivory_disk.webp', import.meta.url).href,
		};
		const aliases: Record<string, string> = {ivory_disk:pieceSprites.manLight, black_disk:pieceSprites.manDark, ivory_king:pieceSprites.kingLight, black_king:pieceSprites.kingDark};
		let completed = 0;
		await Promise.all(Object.entries(reliquaryAssets).map(async ([path, url]) => {
			const name = path.split('/').pop()!.replace('.webp', '');
			const image = await loadImage(boardDelivery(name, url as string));
			// Promise.all rejects before its siblings settle: never publish stale work.
			if (this.startupFailed) return;
			this.textures.addImage(`reliquary_${name}`, image);
			if (aliases[name]) this.textures.addImage(aliases[name], image);
			window.checkersStartup?.status(`Доска и шашки: ${++completed}/${Object.keys(reliquaryAssets).length}`);
		}));
		// Six siege source layers are the man body: base 724, insert 450x402, front.
		// Decode before buildPlayfield, including reduced motion. A missing layer
		// must not become a second whole disk — renderPiece keeps one disk then.
		const tiers = import.meta.glob('./ui/siege/{white,black}-{base,moving,front}.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
		await Promise.all(Object.entries(tiers).map(async ([path, url]) => {
			const name = path.split('/').pop()?.replace('.webp', '');
			if (!name) return;
			try {
				const image = await loadImage(url);
				if (this.startupFailed) return;
				this.textures.addImage(`piece-tier-${name}`, image);
			} catch {
				return;
			}
		}));
		this.load.image('marker_staples', new URL('../modules/board/markers/staples.png', import.meta.url).href);
		this.load.image('marker_staples_amber', new URL('../modules/board/markers/staples-amber.png', import.meta.url).href);
		this.load.image('marker_staples_copper', new URL('../modules/board/markers/staples-copper.png', import.meta.url).href);
		this.load.image('marker_arrow_amber', new URL('../modules/board/markers/arrow-amber.png', import.meta.url).href);
		this.load.image('marker_arrow_copper', new URL('../modules/board/markers/arrow-copper.png', import.meta.url).href);
		this.load.image('marker_cut', new URL('../modules/board/markers/cut.png', import.meta.url).href);
	}

	private queueMatchInteractive(): void {
		// 112 selection-v2 frames stay menu/result art. Brackets are markers/*.png.
		// The man body is the six siege layers in the critical pack, not this one.
		// Only the king seal is a selection texture here, and it is one small file.
		this.load.image('selection_king-seal', new URL('../modules/board/selection/markers/king-seal-proposed.webp', import.meta.url).href);
	}

	/** Menu/result endpoint frames, warmed in idle time after input is already allowed. */
	private warmSelectionEndpoints(): void {
		if (this.endpointWarmUp || this.startupFailed) return;
		this.endpointWarmUp = true;
		const urls = Object.entries(
			import.meta.glob('../modules/board/selection-v2/frames/*/*-{00,55}.webp', {
				query: '?url',
				import: 'default',
			}) as Record<string, () => Promise<string>>,
		).sort(([a], [b]) => a.localeCompare(b));
		void Promise.all(urls.map(([, load]) => load()))
			.then((resolved) => {
				this.stopWarmUp = warmImages(resolved, () => this.startupFailed || this.phase === 'over');
			})
			.catch(() => {
				// Endpoint art is decoration: a failure never changes match state.
			});
	}

	private queueKingFire(): void {
		// KingFire polish: heavy; lazy after interactiveReady — do not gate countdown/reveal.
		preloadKingFire(this);
	}


	private async bootPlayfield(): Promise<void> {
		if (this.startupFailed) return;
		window.checkersStartup?.status('Загружаем доску и шашки…');
		// Minimal pack to show board and accept first move; outside preload so HTML unlock is free.
		try { await this.queueTitleCritical(); } catch {
			this.startupFailed = true;
			window.checkersStartup?.fail('Не удалось загрузить доску. Проверьте соединение и повторите загрузку.');
			return;
		}
		// Bunker HUD faces are small and needed at depart — keep on critical path.
		if (this.startupFailed) return;
		window.checkersStartup?.status('Загрузка: маркеры и панели…');
		preloadBunkerPanels(this);
		await this.flushLoader();
		if (this.startupFailed) return;
		this.buildPlayfield();
		if (!this.playfieldBuilt) return;
		// Board + pieces are on screen-capable textures here: this is the reveal gate.
		markPerf('playfield-ready');
		// Menu theme and result ceremony must not compete with this pack. Not awaited.
		this.title?.warmAudio();
	}

	private async bootMatchInteractive(): Promise<void> {
		if (this.startupFailed) return;
		await this.playfieldReady;
		if (this.startupFailed || !this.playfieldBuilt) return;
		window.checkersStartup?.status('Загрузка: подготовка взаимодействия…');
		this.queueMatchInteractive();
		await this.flushLoader();
		if (this.startupFailed) return;
		for (const key of this.textures.getTextureKeys()) {
			if (!key.startsWith('selection_')) continue;
			this.textures.get(key)?.setFilter(Phaser.Textures.FilterMode.LINEAR);
		}
		// DOM controls are decoration, not an interactive/reveal prerequisite.
		// Warm only after the board + HUD + input packs released the network.
		warmMatchActionArt();
		// No mid-match disk→v2 refresh: reveal waits on interactiveReady.
	}

	private async queueSelectionOverlay(): Promise<void> {
		// Selection overlay pack: decoration only, so it loads lazily after the
		// reveal — the start path stays board + pieces + HUD.
		const frames = import.meta.glob(
			'../modules/board/selection-overlay/*.png',
			{ query: '?url', import: 'default' },
		) as Record<string, () => Promise<string>>;
		const entries = await Promise.all(
			Object.entries(frames).map(
				async ([path, load]) => [path, await load()] as const,
			),
		);
		for (const [path, url] of entries) {
			const frame = path
				.split('/')
				.pop()!
				.replace('.png', '')
				.replace('select_', '') as SelectionOverlayFrame;
			this.load.image(selectionOverlayTexture(frame), url);
		}
	}

	private async bootSelectionOverlay(): Promise<void> {
		if (this.startupFailed || !this.playfieldBuilt) return;
		await this.queueSelectionOverlay();
		await this.flushLoader();
		if (this.startupFailed) return;
		for (const key of this.textures.getTextureKeys()) {
			if (!key.startsWith('selection_overlay_')) continue;
			this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
		}
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


	/** Window instance: its DOM art is all it needs, so it is never gated on a Phaser pack. */
	private ensureOverlay(): ReturnType<typeof createResultOverlay> | undefined {
		if (this.startupFailed || !this.playfieldBuilt) return undefined;
		if (!this.overlay) {
			this.overlay = createResultOverlay(this, {
				onPlayAgain: () => {
					if (this.online) {
						this.showTitle();
						void this.requestOnline();
					} else void this.startMatch();
				},
				onMenu: () => {
					this.showTitle();
				},
			});
			this.overlay.layout(logicalSize(this).width, logicalSize(this).height);
			// Local review seam only; stripped from production and opt-in by URL.
			if (import.meta.env.DEV && new URLSearchParams(location.search).has('resultReview')) {
				const review = (event: Event) => {
					if (this.phase === 'title' || this.phase === 'over' || this.online) return;
					const outcome = (event as CustomEvent).detail;
					this.endMatch(outcome === 'draw' ? 'draw' : outcome === 'win' ? this.humanSide : this.humanSide === 'white' ? 'black' : 'white');
				};
				window.addEventListener('result-review', review);
				this.events.once('shutdown', () => window.removeEventListener('result-review', review));
			}
		}
		return this.overlay;
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
		// Keep the failure and retry/exit actions visible until the user acts.
	}

	private async seatResume(): Promise<void> {
		if (this.phase !== 'title') return;
		if (new URLSearchParams(location.search).get('join')) return;
		this.live?.close();
		this.live = openLive({
			onStart: (color, _matchId, snap) => {
				if (this.phase !== 'title') {
					this.applyResume(color, snap);
					return;
				}
				if (!snap.begun && !snap.pieces.length && snap.ply < 1) return;
				this.online = true;
				this.humanSide = color;
				this.lastPly = snap.ply;
				this.serverTurn = snap.turn;
				this.onlineBegun = snap.begun || snap.ply > 0;
				if (snap.pieces.length) this.position = positionFromSnapshot(snap);
				this.title.clearSearch();
				void this.requestStartFromOpening();
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
				const side = winner === 'draw' ? 'draw' : youWin === true ? this.humanSide : youWin === false ? (this.humanSide === 'white' ? 'black' : 'white') : winner;
				this.endMatch(side, reason);
			},
		});
		await this.live.connect();
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
		if (window.checkersStartup) window.checkersStartup.source = 'play';
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
				if (this.phase !== 'title') {
					this.applyResume(color, snap);
					return;
				}
				this.searchPhase = 'found';
				this.stopSearchTicker();
				this.paintSearch();
				this.online = true;
				this.humanSide = color;
				this.lastPly = snap.ply;
				this.serverTurn = snap.turn;
				this.onlineBegun = snap.begun;
				if (snap.pieces.length) this.position = positionFromSnapshot(snap);
				if (snap.begun && this.phase === 'title') {
					this.title.clearSearch();
					void this.requestStartFromOpening();
					return;
				}
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
				const side =
					winner === 'draw' ? 'draw' : youWin === true
						? this.humanSide
						: youWin === false
							? this.humanSide === 'white'
								? 'black'
								: 'white'
							: winner;
				this.endMatch(side, reason);
			},
			onError: (error) => {
				this.pendingHaptic = null;
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

	private applyAuthoritativeClocks(snap: MatchSnapshot): void {
		if (!snap.clocks) return;
		this.clocks = { white: snap.clocks.banks.white, black: snap.clocks.banks.black };
		this.remoteClockPaused = snap.clocks.paused;
		this.dropUntil = snap.clocks.dropUntil ?? 0;
		this.dropServerNow = snap.clocks.serverNow ?? 0;
		this.dropReceivedAt = Date.now();
		if (this.remoteClockPaused) this.flagLock = false;
		const elapsed = Math.max(0, snap.clocks.serverNow - snap.clocks.turnStarted);
		this.clockStartedAt = this.remoteClockPaused ? this.time.now : this.time.now - elapsed;
		this.paintClock();
	}

	private applyResume(color: Side, snap: MatchSnapshot): void {
		this.pendingHaptic = null;
		if (this.acceptedResult) return;
		this.online = true;
		this.humanSide = color;
		this.lastPly = snap.ply;
		this.serverTurn = snap.turn;
		this.onlineBegun = snap.begun || snap.ply > 0;
		if (snap.pieces.length) this.position = positionFromSnapshot(snap);
		this.inboundNet = [];
		this.moving = false;
		this.humanChain = null;
		this.selected = null;
		if (snap.begun) this.finishOnlineOpening();
		if (!this.countingIn && snap.begun) {
			this.phase = this.serverTurn === this.humanSide ? 'human' : 'bot';
		}
		this.applyAuthoritativeClocks(snap);
		this.refresh();
		this.drainInbound();
	}

	private finishOnlineOpening(): void {
		if (!this.countingIn) return;
		this.stopCountdown();
		markPerf('counting-in-false');
		this.title.hide(true);
		this.title.beginMatch();
		this.hud?.finishReveal();
	}

	private applyBegin(snap: MatchSnapshot): void {
		this.pendingHaptic = null;
		if (this.acceptedResult) return;
		this.onlineBegun = true;
		this.lastPly = snap.ply;
		this.serverTurn = snap.turn;
		if (snap.pieces.length) this.position = positionFromSnapshot(snap);
		this.phase = this.serverTurn === this.humanSide ? 'human' : 'bot';
		this.finishOnlineOpening();
		this.applyAuthoritativeClocks(snap);
		this.paintClock();
		this.refresh();
		this.drainInbound();
	}

	private applyState(snap: MatchSnapshot): void {
		this.pendingHaptic = null;
		if (this.acceptedResult) return;
		this.lastPly = snap.ply;
		this.serverTurn = snap.turn;
		this.onlineBegun = snap.begun;
		if (snap.pieces.length) this.position = positionFromSnapshot(snap);
		this.inboundNet = [];
		this.moving = false;
		this.humanChain = null;
		this.selected = null;
		if (snap.begun) this.finishOnlineOpening();
		if (!this.countingIn) {
			this.phase = !snap.begun ? this.phase : this.serverTurn === this.humanSide ? 'human' : 'bot';
		}
		this.applyAuthoritativeClocks(snap);
		this.refresh();
	}

	private drainInbound(): void {
		if ((this.phase === 'over' && !this.acceptedResult) || this.resultPresented || this.moving) return;
		const next = takeNextPly(this.inboundNet, this.lastPly);
		if (!next) {
			const gap = this.inboundNet.some((m) => classifyPly(this.lastPly, m.ply) === 'gap');
			if (gap && !this.acceptedResult) {
				this.live?.requestState();
				return;
			}
			// Confirmed outcome never waits on recovery. If a ply is missing, keep
			// the last confirmed board and do not infer a material/mobility reason.
			if (gap && this.resultKind === 'rules') this.resultKind = 'unknown';
			this.presentResult();
			return;
		}
		this.lastPly = next.ply;
		this.serverTurn = next.turn;
		this.applyingNet = true;
		if (next.side === this.humanSide && this.position.turn !== next.side) {
			this.applyingNet = false;
			if (!this.acceptedResult) this.phase = this.serverTurn === this.humanSide ? 'human' : 'bot';
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
				this.scheduleResultWindow();
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
			window.checkersStartup.waitPlay();
			await this.startMatch(true);
			// startMatch no-op while still title: keep bars — committed cleared only by hide/depart or hard fail.
			if (this.phase === 'title') window.checkersStartup.waitPlay();
		} finally {
			this.startingFromOpening = false;
		}
	}

	private async ensureResultOverlay(): Promise<ReturnType<typeof createResultOverlay> | undefined> {
		// Never behind king-fire or the pack: the window paints from its own art.
		return this.resultReady;
	}

	private showTitle(): void {
		this.resultGen += 1;
		this.acceptedResult = null;
		this.resultPresented = false;
		this.stopWarmUp?.();
		this.stopWarmUp = undefined;
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
		this.resultGen += 1;
		this.acceptedResult = null;
		this.resultPresented = false;
		if (fromOpening && this.phase !== 'title') return;
		await this.playfieldReady;
		if (this.startupFailed) return;
		if (fromOpening && this.phase !== 'title') return;
		if (!this.playfieldBuilt || !this.board || !this.hud) return;
		this.stopCountdown();
		this.countingIn = true;
		// A fresh reveal: the rail waits again for this board's first painted frame.
		this.boardPainted = false;
		this.actionsEntered = false;
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
		// Real piece disks stay. Selection-v2 frames are not substituted on the board.
		this.board.setPlayfieldVisible(true);
		this.markBoardFirstFrame();
		this.beginCountdown(fromOpening);
		this.refresh();
	}

	private stopCountdown(): void {
		this.board?.clearOpeningHint();
		this.hud?.stopReveal();
		this.countingIn = false;
	}

	/**
	 * First frame that actually painted the revealed board.
	 *
	 * A scene has no `postrender` event; the real post-render signal is
	 * `Phaser.Core.Events.POST_RENDER` on the game emitter (Game.step, after the
	 * renderer finished the whole frame). Two rAF ticks are not a painted frame,
	 * so they are not used as a substitute. The listener is removed on the first
	 * frame and on shutdown, so nothing is left behind.
	 */
	private markBoardFirstFrame(): void {
		const events = this.game?.events;
		if (!events || this.boardFrameListener) return;
		const shutdown = () => {
			if (this.boardFrameListener !== done) return;
			this.boardFrameListener = undefined;
			events.off(Phaser.Core.Events.POST_RENDER, done);
		};
		const done = () => {
			this.boardFrameListener = undefined;
			events.off(Phaser.Core.Events.POST_RENDER, done);
			this.events.off('shutdown', shutdown);
			markPerf('board-first-frame');
			// The board is on screen now: the rail may follow it. Never earlier.
			this.boardPainted = true;
			if (this.phase !== 'title') this.paintUndo();
		};
		this.boardFrameListener = done;
		events.once(Phaser.Core.Events.POST_RENDER, done);
		this.events.once('shutdown', shutdown);
	}

	private beginCountdown(fromOpening = false): void {
		const board = this.board;
		const hud = this.hud;
		if (!board || !hud) return;
		this.stopCountdown();
		this.countingIn = true;
		if (this.online && this.onlineBegun) {
			// Re-seating an already running match has no decorative timeline.
			this.finishOnlineOpening();
			this.live?.requestState();
			return;
		}
		// Input and banks never wait for the decorative reveal: as soon as the
		// gates leave and the board is on screen the match is already playable.
		const settle = () => {
			if (!this.countingIn) return;
			this.title.speakOrcTurn(orcOpeningTurnLine(this.humanSide), this.humanSide);
			this.clockStartedAt = this.time.now;
			this.countingIn = false;
			markPerf('counting-in-false');
			this.paintClock();
			this.refresh();
			if (this.phase === 'bot') {
				this.refresh();
				this.botTimer?.remove(false);
				this.botTimer = this.time.delayedCall(400, () => this.playBot());
			}
		};
		const handshake = () => {
			if (!this.countingIn) return;
			this.live?.ready();
			this.refresh();
		};
		// Keep closed housings behind the gates. Their completed departure is the
		// only gate: the HUD reveal runs on as decoration behind a playable board.
		hud.setVisible(true);
		const afterTitle = () => {
			if (!this.countingIn) return;
			this.title.beginMatch();
			board.startOpeningHint(this.position, this.humanSide);
			this.title.hintWave();
			if (this.online && !this.onlineBegun) handshake();
			else settle();
			// Decoration only: the panels finish sliding; nothing waits on them.
			hud.startReveal(() => undefined);
		};
		if (fromOpening) this.title.depart(afterTitle);
		else afterTitle();
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
			paused: this.paused || this.remoteClockPaused,
			side,
			turn: this.clockTurn(),
		});
	}

	private onlineHumanTurn(): boolean {
		return this.onlineBegun && this.serverTurn === this.humanSide && this.position.turn === this.humanSide;
	}

	private canSelect(): boolean {
		if (this.paused || this.remoteClockPaused || this.moving || this.countingIn || this.flagLock || this.phase === 'over') return false;
		if (this.online) return this.onlineHumanTurn();
		return this.phase === 'human';
	}

	private paintClock(): void {
		this.hud?.setClock(
			Math.ceil(this.sideRemainingMs('white') / 1000),
			Math.ceil(this.sideRemainingMs('black') / 1000),
			this.countingIn || this.flagLock || this.phase === 'over' ? null : this.clockTurn(),
		);
		const drop = dropNoticeLine(this.dropUntil || undefined, Date.now(), this.dropServerNow, this.dropReceivedAt);
		if (drop) this.hud?.setTurn(drop);
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
		if (!this.actionsEntered) this.paintUndo();
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
		if (this.acceptedResult && this.moving) {
			this.paintClock();
			this.paintUndo();
			return;
		}
		if (this.phase === 'title') {
			this.hud?.setTurn('');
			return;
		}
		if (!this.board || !this.hud) return;
		// Input permission for the human's first move: the user-visible end of the start path.
		if (this.canSelect()) {
			markPerf('first-move-allowed');
			// Decoration warm-up starts only here: never on the reveal path.
			this.warmSelectionEndpoints();
		}
		// Paint the activity edge with the position/status, not the next clock tick.
		this.paintClock();
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
		const drop = dropNoticeLine(this.dropUntil || undefined, Date.now(), this.dropServerNow, this.dropReceivedAt);
		this.hud.setTurn(drop || matchStatus(
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
		if (this.restoringBotUndo) return;
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
			if (!selected || !sameSquare(selected, square)) haptics.play('tick');
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

		const beforeHop = chain.visualPosition;
		const chosen = chain.choose(square);
		if (!chosen) return false;
		const kinds = moveHapticKinds(beforeHop, chosen.hop);
		const actions = kinds.map(() => ({}));
		let landing = 0;
		if (!this.humanChain) this.saveBotUndo();
		this.humanChain = chain;
		this.moving = true;

		const undoGen = this.online ? null : this.botUndoGen;
		const matchGen = this.resultGen;
		this.board?.playMove(chosen.hop, () => {
			if (matchGen !== this.resultGen) return;
			if (undoGen !== null && undoGen !== this.botUndoGen) return;
			this.moving = false;
			if (this.acceptedResult) {
				this.humanChain = null;
				this.drainInbound();
				return;
			}
			this.selected = chain.selected;
			// Time runs through hops and branch decisions; a final tap cannot rescue a flag.
			if (this.sideRemainingMs(this.position.turn) <= 0) {
				this.onFlag();
				return;
			}
			if (chosen.complete) {
				if (this.online) {
					const kind = kinds.at(-1);
					if (kind) this.pendingHaptic = { move: chosen.complete, kind, ply: this.lastPly + 1 };
					this.live?.move(chosen.complete);
					this.drainInbound();
				}
				else this.completeHumanMove(chosen.complete);
			}
			else this.refresh();
		}, () => {
			const index = landing++;
			if (matchGen !== this.resultGen || (undoGen !== null && undoGen !== this.botUndoGen) || this.acceptedResult || this.sideRemainingMs(this.position.turn) <= 0) return;
			// The final online landing waits for the authoritative matching ply.
			if (this.online && chosen.complete && index === kinds.length - 1) return;
			if (kinds[index]) haptics.play(kinds[index], actions[index]);
		}, undefined, true);
		return true;
	}

	private animateMove(move: IMove, after: () => void): void {
		this.moving = true;
		this.selected = null;

		const undoGen = this.online ? null : this.botUndoGen;
		const matchGen = this.resultGen;
		this.board?.playMove(
			move,
			() => {
				if (matchGen !== this.resultGen) return;
				if (undoGen !== null && undoGen !== this.botUndoGen) return;
				this.moving = false;
				after();
				this.drainInbound();
			},
		);
	}

	private resignConfirmation?: ReturnType<typeof bindResignConfirmation>;

	private bindUndoButton(): void {
		document.getElementById('match-undo')?.addEventListener('click', () => this.undoBot());
		const trigger = document.getElementById('match-resign') as HTMLButtonElement | null;
		if (trigger) {
			this.resignConfirmation = bindResignConfirmation(trigger, () => this.resignMatch(),
				() => !this.railConcealed() && this.phase !== 'title' && !this.paused && !this.flagLock);
			this.events?.once('shutdown', () => this.resignConfirmation?.destroy());
		}
	}

	/**
	 * The rail belongs to a ready match: the field must be through the same
	 * reveal gate as the board with HUD (pack ready + first painted frame).
	 * Hidden rail, never a delayed move — input keeps its own timeline.
	 */
	private railConcealed(): boolean {
		return this.phase === 'over' || this.countingIn || !this.playfieldReadyDone || !this.boardPainted ||
			(!this.actionsEntered && this.hud?.isActionsReady?.() === false);
	}

	private paintUndo(): void {
		// The perf seam and other headless specs run without a DOM: the rail is a
		// browser-only surface, so there is nothing to paint there.
		if (typeof document === 'undefined') return;
		const rail = document.getElementById('match-actions');
		const undo = document.getElementById('match-undo') as HTMLButtonElement | null;
		const resign = document.getElementById('match-resign') as HTMLButtonElement | null;
		const inMatch = this.phase !== 'title';
		if (!inMatch || this.phase === 'over') this.resignConfirmation?.dismiss();
		if (rail) {
			rail.hidden = !inMatch;
			// Lifecycle visibility only: the in-card overlay reserves no field space.
			const conceal = this.railConcealed();
			if (!conceal && inMatch) this.actionsEntered = true;
			if (rail.style) rail.style.visibility = conceal ? 'hidden' : '';
			rail.inert = conceal;
			rail.setAttribute('aria-hidden', conceal ? 'true' : 'false');
		}
		if (undo) {
			undo.hidden = !inMatch;
			undo.disabled = this.phase === 'over' || this.phase === 'bot' || this.railConcealed() || !canUndoBot(this.online, this.botUndoStack.length);
			const reason = this.online ? 'В сетевой партии отмена недоступна'
				: this.phase === 'bot' ? 'Дождитесь ответа соперника'
				: 'Отмена появится после вашего хода и ответа соперника';
			undo.title = undo.disabled ? reason : 'Отменить ход';
			const explanation = document.getElementById('match-undo-reason');
			if (explanation) explanation.textContent = undo.disabled ? reason : 'Отменяет ваш ход и ответ соперника';
			if (undo.parentElement) undo.parentElement.title = undo.title;
			if (undo.style) undo.style.visibility = this.railConcealed() ? 'hidden' : '';
		}
		if (resign) {
			resign.hidden = !inMatch;
			resign.disabled =
				this.railConcealed() || this.phase === 'over' || this.paused || this.flagLock;
			if (resign.style) resign.style.visibility = this.railConcealed() ? 'hidden' : '';
		}

	}

	private undoBot(): void {
		if (this.online || this.phase === 'over') return;
		if (!canUndoBot(this.online, this.botUndoStack.length)) return;
		const snap = this.botUndoStack.pop();
		if (!snap) return;
		this.botUndoGen += 1;
		this.botTimer?.remove(false);
		this.botTimer = undefined;
		this.pendingBot = false;
		this.board?.reset();
		this.moving = false;
		this.position = snap.position;
		this.clocks = { ...snap.clocks };
		this.matchPlies = snap.plies.slice();
		this.posKeys = snap.keys.slice();
		this.selected = null;
		this.humanChain = null;
		this.flagLock = false;
		this.resultGen += 1;
		this.overlay?.hide(true);
		this.phase = this.position.turn === this.humanSide ? 'human' : 'bot';
		this.clockStartedAt = this.time.now;
		this.restoringBotUndo = true;
		try { this.refresh(); } finally { this.restoringBotUndo = false; }
	}

	private saveBotUndo(): void {
		if (!this.online) {
			this.botUndoStack.push({
				position: structuredClone(this.position),
				clocks: { ...this.clocks },
				plies: this.matchPlies.slice(),
				keys: this.posKeys.slice(),
			});
			this.paintUndo();
		}
	}

	private playHuman(move: IMove): void {
		this.saveBotUndo();
		this.animateMove(move, () => {
			if (this.online) {
				if (!this.acceptedResult) this.live?.move(move);
				else this.drainInbound();
			} else this.completeHumanMove(move);
		});
	}

	private completeHumanMove(move: IMove): void {
		const mover = this.position.turn;
		const next = apply(this.position, move);
		if (!next) return;
		const pending = this.pendingHaptic;
		this.pendingHaptic = null;
		if (this.online && pending && this.lastPly === pending.ply && mover === this.humanSide &&
			sameSquare(pending.move.from, move.from) && pending.move.path.length === move.path.length &&
			pending.move.path.every((square, index) => sameSquare(square, move.path[index]))) {
			haptics.play(pending.kind, pending);
		}
		if (!this.acceptedResult) this.settleClock(mover);
		// First accepted move of the human side: bots may have played earlier plies.
		// markPerf keeps the first write, so later human moves never move the mark.
		if (mover === this.humanSide) markPerf('first-move-played');
		this.matchPlies.push({ side: mover, from: move.from, path: move.path });
		this.position = next;
		this.humanChain = null;
		this.selected = null;
		this.board?.notePly();
		this.posKeys.push(hashPosition(this.position));
		if (this.acceptedResult) {
			this.applyingNet = false;
			this.drainInbound();
			return;
		}
		const outcome = resultSide(this.position, this.posKeys);
		if (!this.online && outcome === 'draw') {
			this.endMatch('draw');
			return;
		}
		if (!this.online && outcome) {
			this.endMatch(outcome);
			return;
		}
		this.phase = this.online
			? (this.onlineHumanTurn() ? 'human' : 'bot')
			: this.position.turn === this.humanSide ? 'human' : 'bot';
		if (!this.paused && !this.remoteClockPaused) this.title?.turnHandoff();
		this.refresh();
		if (this.online) {
			if (!this.applyingNet && mover === this.humanSide) this.lastPly += 1;
			this.applyingNet = false;
			this.drainInbound();
			return;
		}
		this.botTimer?.remove(false);
		const undoGen = this.botUndoGen;
		this.botTimer = this.time.delayedCall(400, () => {
			if (undoGen === this.botUndoGen) this.playBot();
		});
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
			if (!this.acceptedResult) this.settleClock(mover);
			this.matchPlies.push({ side: mover, from: move.from, path: move.path });
			this.position = next;
			this.posKeys.push(hashPosition(this.position));
			if (this.acceptedResult) {
				this.presentResult();
				return;
			}
			const outcome = resultSide(this.position, this.posKeys);
			if (outcome === 'draw') {
				this.endMatch('draw');
				return;
			}
			if (outcome) {
				this.endMatch(outcome);
				return;
			}
			this.phase = 'human';
			if (!this.paused) this.title?.turnHandoff();
			this.refresh();
		});
	}

	resignMatch(): void {
		if (this.phase === 'title' || this.phase === 'over' || this.flagLock) return;
		if (this.online) {
			this.live?.resign();
			return;
		}
		if (this.paused || !this.board) return;
		this.endMatch(this.humanSide === 'white' ? 'black' : 'white', 'resign');
	}

	private endMatch(side: Side | 'draw', kind = 'rules'): void {
		if (!this.board || this.acceptedResult || this.phase === 'over') return;
		performance.mark('damka:outcome-accepted');
		this.clocks = { white: this.sideRemainingMs('white'), black: this.sideRemainingMs('black') };
		this.acceptedResult = { winner: side, humanSide: this.humanSide, online: this.online,
			reason: verdictReason(side, this.humanSide, kind, this.position, this.posKeys) };
		this.resultKind = kind;
		this.botTimer?.remove(false);
		this.pendingBot = false;
		this.stopCountdown();
		this.board.clearOpeningHint();
		this.phase = 'over';
		this.selected = null;
		this.dropUntil = 0;
		this.paintClock();
		this.paintUndo();
		// Let an already accepted move land. No reset/sync interrupts capture or promotion.
		if (!this.moving) this.drainInbound();
	}

	private resultKind = 'rules';
	private presentResult(): void {
		const result = this.acceptedResult;
		if (!result || this.resultPresented || this.moving || this.phase !== 'over') return;
		this.resultPresented = true;
		performance.mark('damka:result-move-settled');
		// Reasons depending on the position are read only after the final net ply commits.
		result.reason = verdictReason(result.winner, result.humanSide, this.resultKind, this.position, this.posKeys);
		this.humanChain = null;
		this.board?.reset({ keepPromotionFire: this.resultKind === 'rules' });
		this.refresh();
		const { winner: side } = result;
		if (side !== 'draw') {
			const line = orcOutcomeLine(this.resultKind === 'flag' ? 'flag' : 'rules', side === this.humanSide);
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
		const gen = this.resultGen;
		void this.ensureResultOverlay().then((overlay) => {
			if (gen !== this.resultGen || this.phase !== 'over') return;
			overlay?.show(result);
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
