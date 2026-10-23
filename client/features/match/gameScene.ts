import Phaser from 'phaser';
import type { IBoardView } from '@/client/features/match/board';
import { createBoardView } from '@/client/features/match/board';
import { palette } from '@/client/features/match/palette';
import { recordBotMatch } from '@/client/platform/network/cloud';
import { hashPosition } from '@/shared/protocol/matchState';
import type { Side } from '@/shared/rules';
import {
	createInitialPosition,
	legalMoves,
	remainingMs,
} from '@/shared/rules';
import { capturedOnSegment } from '@/shared/rules/parts/capturedOnPath';
import { orcOutcomeLine, orcTimeLow } from '../../audio/orcResult';
import { orcOpeningTurnLine } from '../../audio/orcTurn';
import { defeatTauntCue } from '../../audio/pieceSfx';
import { uiSfx } from '../../audio/uiSfx';
import {
	installDisplayDensity,
	logicalSize,
} from '../../platform/browser/displayDensity';
import { optionalPack } from '../../platform/browser/idleWork';
import { panelDurationMs } from '../../platform/browser/panelReveal';
import { markPerf } from '../../platform/browser/perfMarks';
import type { IYandexSdk } from '../../platform/sdk/IYandexSdk';
import { createOpeningOverlay } from '../menu/openingOverlay';
import { getAutoMove, getBotSkill, getTimeControl } from '../settings/settings';
import { bindMatchActions } from './actions/bindMatchActions';
import { canResign } from './actions/matchActionState';
import { BotTurn } from './bot/botTurn';
import { createHud } from './hud/createHud';
import { dropNoticeTime } from './hud/dropNotice';
import { matchPanelState } from './hud/panelState';
import { MatchClock } from './matchClock';
import { MatchInteraction } from './matchInteraction';
import { MatchResources } from './matchResources';
import { MatchSession } from './matchSession';
import { OnlineMatchCoordinator } from './online/onlineMatchCoordinator';
import { createResultOverlay } from './result/boardVerdict';
import { verdictReason } from './result/verdictReason';

export class GameScene extends Phaser.Scene {
	private session!: MatchSession;
	private clock!: MatchClock;
	private bot!: BotTurn;
	private actions?: ReturnType<typeof bindMatchActions>;
	private resources!: MatchResources;
	private network!: OnlineMatchCoordinator;
	private interaction!: MatchInteraction;
	private board?: IBoardView;
	private hud?: ReturnType<typeof createHud>;
	private overlay?: ReturnType<typeof createResultOverlay>;
	private title!: ReturnType<typeof createOpeningOverlay>;
	private sdk!: IYandexSdk;

	/**
	 * Reveal readiness of the board, shared with the HUD. The rail is a match
	 * control: it must not be on screen before the playfield it belongs to.
	 * `playfieldReadyDone` is the pack gate, `boardPainted` the first painted
	 * frame of the revealed board (same seam the perf timeline reads).
	 */
	private playfieldReadyDone = false;
	private boardPainted = false;
	private actionsEntered = false;
	private captureAvailable = false;
	private timeLowSaid = false;
	/** Pending first-frame listener; kept so shutdown can remove it. */
	private boardFrameListener?: () => void;

	constructor() {
		super({ key: 'GameScene' });
	}
	private playfieldBuilt = false;
	private startingFromOpening = false;
	/** Settled by bootPlayfield; created before overlay so await never sees undefined. */
	private settlePlayfieldReady!: () => void;
	private playfieldReady!: Promise<void>;
	private resultReady!: Promise<
		ReturnType<typeof createResultOverlay> | undefined
	>;
	private interactiveReady!: Promise<void>;

	init(): void {
		this.session = new MatchSession();
		this.clock = new MatchClock();
		this.bot = new BotTurn((delay, callback) =>
			this.time.delayedCall(delay, callback),
		);
		this.resources = new MatchResources(this, {
			isBuilt: () => this.playfieldBuilt,
			build: () => this.buildPlayfield(),
			warmAudio: () => this.title?.warmAudio(),
			ready: () => this.playfieldReady,
			isOver: () => this.session.phase === 'over',
		});
		this.network = new OnlineMatchCoordinator(this.session, this.clock, {
			now: () => this.time.now,
			delay: (delay, callback) => this.time.delayedCall(delay, callback),
			repeat: (options) => this.time.addEvent(options),
			search: (phase, seconds, join) =>
				this.title.setSearch(phase, seconds, join),
			clearSearch: () => this.title.clearSearch(),
			humanSide: () => this.title.humanSide(),
			start: () => this.requestStartFromOpening(),
			refresh: () => this.refresh(),
			paintClock: () => this.paintClock(),
			stopCountdown: () => this.stopCountdown(),
			finishOpening: () => {
				this.title.hide(true);
				this.title.beginMatch();
				this.hud?.finishReveal();
			},
			end: (side, reason) => this.endMatch(side, reason),
			presentResult: () => this.presentResult(),
			playHumanLocal: (move) => this.interaction.playHumanLocal(move),
			paintActions: () => this.paintUndo(),
			resetBoard: () => this.board?.reset(),
			playRemote: (move) => this.interaction.playRemote(move),
		});
		this.interaction = new MatchInteraction(
			this.session,
			this.clock,
			this.bot,
			this.network,
			{
				board: () => this.board,
				now: () => this.time.now,
				hideResult: () => this.overlay?.hide(true),
				turnHandoff: () => this.title?.turnHandoff(),
				refresh: () => this.refresh(),
				paintActions: () => this.paintUndo(),
				canSelect: () => this.canSelect(),
				remaining: (side) => this.sideRemainingMs(side),
				flag: () => this.onFlag(),
				end: (side, kind) => this.endMatch(side, kind),
				presentResult: () => this.presentResult(),
				botSkill: () => getBotSkill(),
				autoMove: () => getAutoMove(),
			},
		);
		this.playfieldReady = new Promise((resolve) => {
			this.settlePlayfieldReady = resolve;
		});
		this.actions = undefined;
		this.board = undefined;
		this.hud = undefined;
		this.overlay = undefined;
		this.playfieldReadyDone = false;
		this.boardPainted = false;
		this.actionsEntered = false;
		this.captureAvailable = false;
		this.timeLowSaid = false;
		this.boardFrameListener = undefined;
		this.playfieldBuilt = false;
		this.startingFromOpening = false;
		this.resultReady = Promise.resolve(undefined);
		this.interactiveReady = Promise.resolve();
	}

	preload(): void {
		this.resources.failed = false;
		// Title is HTML-first: do not queue heavy packs here — unlock must not wait on them.
		window.checkersStartup?.status('Подключаем игру…');
		const resources = this.resources;
		const loadError = (file: { key?: string }) => {
			if (resources !== this.resources) return;
			// Optional seal/fire may be absent; keep the loader completion and later
			// decoration warmup alive. The renderer hides an unavailable seal.
			if (
				file.key === 'selection_king-seal' ||
				file.key === 'match-hud' ||
				file.key?.startsWith('king-fire_')
			)
				return;
			this.resources.failed = true;
			clearTimeout(window.checkersStartup?.watchdog);
			window.checkersStartup?.fail(
				'Не удалось загрузить игровые ресурсы. Проверьте соединение и повторите загрузку.',
			);
		};
		this.load.on('loaderror', loadError);
		this.events.once('shutdown', () => this.load.off('loaderror', loadError));
	}

	create(): void {
		const lifecycle = this.session;
		const settle = this.settlePlayfieldReady;
		if (this.resources.failed) {
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
		void this.resources.bootPlayfield().then(
			() => {
				if (lifecycle !== this.session) return;
				if (!this.resources.failed) this.playfieldReadyDone = true;
				settle();
			},
			() => settle(),
		);
		// Selection-v2: background after playfieldReady; gates board *reveal*, not HTML unlock.
		this.interactiveReady = this.resources.bootMatchInteractive();
		void this.interactiveReady.then(() => {
			if (lifecycle !== this.session) return;
			if (
				this.resources.failed ||
				this.session.phase === 'title' ||
				!this.playfieldBuilt
			)
				return;
			this.refresh();
		});
		// KingFire polish, the win/lose window and the result pack are separate branches off the
		// reveal: a short bot match must never wait for the whole king-fire chain.
		this.scheduleResultWindow();
		this.title = createOpeningOverlay(this, {
			isPaused: () => this.session.paused,
			onPlayBot: () => {
				this.session.online = false;
				this.session.humanSide = this.title.humanSide();
				void this.requestStartFromOpening();
			},
			onPlayOnline: () => {
				this.network.beginSearchUi('human-menu');
			},
			onSearchFind: () => {
				void this.network.requestOnline();
			},
			onFriendCreate: () => {
				void this.network.requestOnline('host');
			},
			onFriendEnter: () => {
				this.network.beginSearchUi('friend-enter');
			},
			onFriendJoin: (code) => {
				const digits = code.replace(/\D/g, '').slice(0, 6);
				if (!/^\d{6}$/.test(digits) || digits === '000000') {
					this.network.searchPhase = /^\d{6}$/.test(digits)
						? 'friend-miss'
						: 'friend-invalid';
					this.network.paintSearch();
					return;
				}
				void this.network.requestOnline('join', digits);
				uiSfx('ui-tap');
			},
			onSearchCancel: () => this.network.cancelSearch(),
		});
		this.actions = bindMatchActions({
			offerDraw: () => this.network.live?.offerDraw(),
			acceptDraw: () => this.network.live?.acceptDraw(),
			declineDraw: () => this.network.live?.declineDraw(),
			undo: () => this.interaction.undoBot(),
			resign: () => this.interaction.resignMatch(),
			available: () => !this.railConcealed() && canResign(this.session),
		});
		this.events.once('shutdown', () => {
			this.actions?.dispose();
			this.network.dispose();
			this.resources.dispose();
			this.session.resultGen++;
			this.session.botUndoGen++;
			this.bot.cancel();
		});
		const stopPause = this.sdk.onPause(() => {
			this.setPaused(true);
		});
		const stopResume = this.sdk.onResume(() => {
			this.setPaused(false);
		});
		this.events.once('shutdown', () => {
			stopPause?.();
			stopResume?.();
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
		void this.network.seatResume();
		{
			const join = new URLSearchParams(location.search).get('join');
			if (join) void this.network.requestOnline('join', join);
		}
		// One-tap: early «Играть» before Phaser must auto-start once assets are wired.
		this.title.flushPendingPlay();
		this.title.flushPendingOnline();
		this.sdk.ready();
		if (import.meta.env.DEV) {
			void import('./dev/scenarios')
				.then(({ runDevScenario }) =>
					runDevScenario({
						ready: () => this.interactiveReady,
						start: async () => {
							this.session.preview = true;
							this.session.online = false;
							this.network.cancelSearch();
							await this.startMatch();
						},
						configure: (position, bankMs) => {
							this.stopCountdown();
							this.bot.cancel();
							this.session.position = position;
							this.session.humanSide = 'white';
							this.session.phase = 'human';
							this.session.posKeys = [hashPosition(position)];
							this.clock.banks = { white: bankMs, black: bankMs };
							this.clock.startedAt = this.time.now;
							this.title.hide(true);
							this.title.beginMatch();
							this.hud?.finishReveal();
							this.refresh();
						},
						result: (winner) => this.endMatch(winner),
					}),
				)
				.catch((error) => console.error('Dev scenario failed', error));
		}
	}

	/**
	 * Off the board reveal: king-fire polish, then the window itself (its own DOM art only
	 * starts downloading once the overlay exists), then the Phaser result pack in idle.
	 * Nothing here gates the window: it paints from its own art, and the pack is warmed
	 * long before the first possible final of a short bot match.
	 */
	private scheduleResultWindow(): void {
		const lifecycle = this.session;
		void this.interactiveReady.then(async () => {
			if (lifecycle !== this.session || this.resources.failed) return;
			// Small overlay pack first: the board can then show selection at once.
			// Both packs are decoration, and each owns its own failure: a rejected
			// lazy import of the overlay must not become an unhandled rejection and
			// must not cancel the king-fire warm-up queued behind it.
			const markOverlayUnavailable = (): void => {
				this.resources.missingDecoration.selectionOverlay = true;
			};
			await optionalPack(
				'selection-overlay',
				() => this.resources.bootSelectionOverlay(),
				markOverlayUnavailable,
			);
			await optionalPack(
				'king-fire',
				() => this.resources.bootKingFire(),
				() => {
					this.resources.missingDecoration.kingFire = true;
				},
			);
		});
		this.resultReady = this.playfieldReady.then(() =>
			lifecycle === this.session ? this.ensureOverlay() : undefined,
		);
	}

	/** Window instance: its DOM art is all it needs, so it is never gated on a Phaser pack. */
	private ensureOverlay(): ReturnType<typeof createResultOverlay> | undefined {
		if (this.resources.failed || !this.playfieldBuilt) return undefined;
		if (!this.overlay) {
			this.overlay = createResultOverlay(this, {
				onPlayAgain: () => {
					if (this.session.online) {
						this.showTitle();
						void this.network.requestOnline();
					} else void this.startMatch();
				},
				onMenu: () => {
					this.showTitle();
				},
			});
			this.overlay.layout(logicalSize(this).width, logicalSize(this).height);
		}
		return this.overlay;
	}

	private buildPlayfield(): void {
		if (this.playfieldBuilt || this.resources.failed) return;
		this.hud = createHud(this, {
			onRevealProgress: (elapsed, reduced) => {
				this.board?.paintOpeningHint(elapsed / panelDurationMs, reduced);
			},
			isPaused: () => this.session.paused,
			onAutoChange: () => {
				this.refresh();
			},
		});
		this.hud.setVisible(false);
		this.board = createBoardView(
			this,
			(square) => {
				this.interaction.onSquare(square);
			},
			() => this.interaction.cancelSelection(),
			() =>
				this.hud!.isMenuOpen() ||
				this.session.phase === 'over' ||
				this.session.phase === 'title',
		);
		this.board.setPlayfieldVisible(false);
		const { width, height } = logicalSize(this);
		this.board.layout(width, height);
		this.hud.layout(width, height);
		this.playfieldBuilt = true;
	}

	private async requestStartFromOpening(): Promise<void> {
		const lifecycle = this.session;
		if (this.session.phase !== 'title' || this.startingFromOpening) return;
		this.startingFromOpening = true;
		window.checkersStartup.pendingPlay = false;
		try {
			window.checkersStartup.waitPlay();
			await this.playfieldReady;
			if (lifecycle !== this.session) return;
			// Hard fail: clear committed only; fail() owns the error UI — never calm unlock.
			if (this.resources.failed) {
				window.checkersStartup.playCommitted = false;
				return;
			}
			// Soft leave (no longer title): do not unlock idle «Играть».
			if (this.session.phase !== 'title') return;
			// If boot resolved without a playfield, rebuild and keep waiting on the promise.
			if (!this.playfieldBuilt) {
				window.checkersStartup.waitPlay();
				this.playfieldReady = this.resources.bootPlayfield();
				this.interactiveReady = this.resources.bootMatchInteractive();
				this.scheduleResultWindow();
				await this.playfieldReady;
				if (lifecycle !== this.session) return;
				if (this.resources.failed) {
					window.checkersStartup.playCommitted = false;
					return;
				}
				if (this.session.phase !== 'title') return;
				if (!this.playfieldBuilt) {
					window.checkersStartup.waitPlay();
					return;
				}
			}
			window.checkersStartup.waitPlay();
			await this.startMatch(true);
			// startMatch no-op while still title: keep bars — committed cleared only by hide/depart or hard fail.
			if (this.session.phase === 'title') window.checkersStartup.waitPlay();
		} finally {
			this.startingFromOpening = false;
		}
	}

	private async ensureResultOverlay(): Promise<
		ReturnType<typeof createResultOverlay> | undefined
	> {
		// Never behind king-fire or the pack: the window paints from its own art.
		return this.resultReady;
	}

	private showTitle(): void {
		this.session.resultGen += 1;
		this.session.acceptedResult = null;
		this.session.resultPresented = false;
		this.resources.stopWarmup();
		this.session.humanChain = null;
		this.bot.cancel();
		this.tweens.killAll();
		this.board?.reset();
		this.session.online = false;
		this.network.live?.close();
		this.network.live = null;
		this.network.onlineBegun = false;
		this.network.lastPly = 0;
		this.network.inboundNet = [];
		this.board?.setFacing('white');
		this.hud?.setFacing('white');
		this.session.moving = false;
		this.session.position = createInitialPosition();
		this.session.selected = null;
		this.session.phase = 'title';
		this.timeLowSaid = false;
		this.bot.pending = false;
		this.session.humanSide = 'white';
		this.overlay?.hide();
		this.hud?.setVisible(false);
		this.paintUndo();
		this.stopCountdown();
		this.board?.setPlayfieldVisible(false);
		this.title.show();
		this.refresh();
	}

	private async startMatch(fromOpening = false): Promise<void> {
		const lifecycle = this.session;
		this.session.resultGen += 1;
		this.session.acceptedResult = null;
		this.session.resultPresented = false;
		if (fromOpening && this.session.phase !== 'title') return;
		await this.playfieldReady;
		if (lifecycle !== this.session) return;
		if (this.resources.failed) return;
		if (fromOpening && this.session.phase !== 'title') return;
		if (!this.playfieldBuilt || !this.board || !this.hud) return;
		this.stopCountdown();
		this.session.countingIn = true;
		// A fresh reveal: the rail waits again for this board's first painted frame.
		this.boardPainted = false;
		this.actionsEntered = false;
		this.session.humanChain = null;
		this.bot.cancel();
		this.tweens.killAll();
		this.board.reset();
		this.board.setFacing(this.session.humanSide);
		this.hud.setFacing(this.session.humanSide);
		this.session.moving = false;
		this.session.position = createInitialPosition();
		this.session.selected = null;
		this.session.phase = this.session.humanSide === 'black' ? 'bot' : 'human';
		this.timeLowSaid = false;
		this.bot.pending = false;
		this.clock.reset(this.session.online ? this.clock.timeControl : getTimeControl());
		this.session.flagLock = false;
		this.session.matchPlies = [];
		this.session.posKeys = [hashPosition(this.session.position)];
		this.session.botUndoStack = [];
		this.network.lastPly = this.session.online ? this.network.lastPly : 0;
		this.network.inboundNet = [];

		this.hud.setClock(
			Math.ceil(this.clock.banks.white / 1000),
			Math.ceil(this.clock.banks.black / 1000),
		);
		if (!fromOpening) this.title.hide();
		this.overlay?.hide();
		this.hud.prepareClosed();
		this.hud.setVisible(true);
		const difficulty = { easy: 'лёгкая', normal: 'обычная', hard: 'сложная' }[getBotSkill()];
		this.hud.setOpponent(
			this.session.online ? 'Соперник' : 'Компьютер',
			this.session.online
				? `${this.session.humanSide === 'white' ? 'Чёрные' : 'Белые'} · ${this.clock.timeControl}`
				: `${difficulty[0].toUpperCase()}${difficulty.slice(1)} · ${this.clock.timeControl}`,
		);
		// Real piece disks stay. Selection-v2 frames are not substituted on the board.
		this.board.setPlayfieldVisible(true);
		this.markBoardFirstFrame();
		this.beginCountdown(fromOpening);
		this.refresh();
	}

	private stopCountdown(): void {
		this.board?.clearOpeningHint();
		this.hud?.stopReveal();
		this.session.countingIn = false;
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
			if (this.session.phase !== 'title') this.paintUndo();
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
		this.session.countingIn = true;
		if (this.session.online && this.network.onlineBegun) {
			// Re-seating an already running match has no decorative timeline.
			this.network.finishOnlineOpening();
			this.network.live?.requestState();
			return;
		}
		const settle = () => {
			if (!this.session.countingIn) return;
			this.title.speakOrcTurn(
				orcOpeningTurnLine(this.session.humanSide),
				this.session.humanSide,
			);
			this.clock.startedAt = this.time.now;
			this.session.countingIn = false;
			markPerf('counting-in-false');
			this.paintClock();
			this.refresh();
			if (this.session.phase === 'bot') {
				this.refresh();
				this.bot.cancel();
				this.bot.schedule(() => this.interaction.playBot());
			}
		};
		const handshake = () => {
			if (!this.session.countingIn) return;
			this.network.live?.ready();
			this.refresh();
		};
		hud.setVisible(true);
		const afterTitle = () => {
			if (!this.session.countingIn) return;
			this.title.beginMatch();
			board.startOpeningHint(this.session.position, this.session.humanSide);
			if (this.session.online && !this.network.onlineBegun) handshake();
			else settle();
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
		if (this.session.online && this.network.onlineBegun) {
			return this.network.serverTurn;
		}
		return this.session.position.turn;
	}

	private sideRemainingMs(side: Side): number {
		return this.clock.remaining(side, this.time.now, {
			countingIn: this.session.countingIn,
			phase: this.session.phase,
			paused: this.session.paused,
			turn: this.clockTurn(),
		});
	}

	private onlineHumanTurn(): boolean {
		return (
			this.network.onlineBegun &&
			this.network.serverTurn === this.session.humanSide &&
			this.session.position.turn === this.session.humanSide
		);
	}

	private canSelect(): boolean {
		if (
			this.session.paused ||
			this.clock.remotePaused ||
			this.session.moving ||
			this.session.countingIn ||
			this.session.flagLock ||
			this.session.phase === 'over'
		)
			return false;
		if (this.session.online) return this.onlineHumanTurn();
		return this.session.phase === 'human';
	}

	private paintClock(): void {
		this.hud?.setClock(
			Math.ceil(this.sideRemainingMs('white') / 1000),
			Math.ceil(this.sideRemainingMs('black') / 1000),
			this.session.countingIn ||
				this.session.flagLock ||
				this.session.phase === 'over'
				? null
				: this.clockTurn(),
		);
		this.paintPanelState();
	}

	private paintPanelState(): void {
		if (!this.hud || this.session.phase === 'title') return;
		this.hud.setState(matchPanelState({
			phase: this.session.phase,
			preparing: this.session.countingIn || (this.session.online && !this.network.onlineBegun),
			paused: this.session.paused || this.clock.remotePaused,
			waitingResult: this.session.flagLock,
			humanTurn: this.session.online ? this.onlineHumanTurn() : this.session.phase === 'human',
			capture: this.captureAvailable,
			continuing: Boolean(this.session.humanChain),
			disconnectedTime: dropNoticeTime(
				this.network.dropUntil || undefined, Date.now(), this.network.dropServerNow, this.network.dropReceivedAt,
			),
			outcome: this.session.acceptedResult,
		}));
	}

	private tickClock(): void {
		if (this.session.phase === 'title') {
			return;
		}
		if (this.session.countingIn) {
			this.paintClock();
			return;
		}
		this.paintClock();
		if (!this.actionsEntered) this.paintUndo();
		if (
			this.session.paused ||
			this.session.moving ||
			this.session.flagLock ||
			this.session.countingIn ||
			this.session.phase === 'over'
		) {
			return;
		}
		const own = this.sideRemainingMs(this.session.humanSide);
		if (
			orcTimeLow(own, this.timeLowSaid) &&
			this.clockTurn() === this.session.humanSide
		) {
			this.timeLowSaid = true;
			this.title?.speakOrcTurn('time-low', this.session.humanSide);
		}
		const side = this.clockTurn();
		const left = remainingMs(
			this.clock.banks[side],
			this.clock.startedAt,
			this.time.now,
			false,
		);
		if (left <= 0) {
			if (this.session.online && side !== this.session.humanSide) return;
			this.onFlag();
		}
	}

	private onFlag(): void {
		if (
			this.session.flagLock ||
			this.session.moving ||
			this.session.countingIn ||
			this.session.phase === 'over'
		) {
			return;
		}
		if (this.session.online) {
			this.session.flagLock = true;
			this.session.selected = null;
			this.session.humanChain = null;
			this.refresh();
			this.network.live?.flag();
			return;
		}
		this.session.flagLock = true;
		const loser = this.session.position.turn;
		const won = loser === 'white' ? 'black' : 'white';
		this.endMatch(won, 'flag');
	}

	private refresh(): void {
		if (this.session.acceptedResult && this.session.moving) {
			this.paintClock();
			this.paintUndo();
			return;
		}
		if (this.session.phase === 'title') {
			return;
		}
		if (!this.board || !this.hud) return;
		// Input permission for the human's first move: the user-visible end of the start path.
		if (this.canSelect()) {
			markPerf('first-move-allowed');
			// Decoration warm-up starts only here: never on the reveal path.
			this.resources.warmSelectionEndpoints();
		}
		// Paint the activity edge with the position/status, not the next clock tick.
		this.paintClock();
		this.board.sync(
			this.session.humanChain?.visualPosition ?? this.session.position,
			this.interaction.humanHighlights(),
			this.session.selected,
			this.interaction.optionMoves(),
			this.session.countingIn
				? undefined
				: this.canSelect()
					? (this.session.humanChain?.remainingRoutes ??
						legalMoves(this.session.position))
					: [],
		);
		this.board.setWaitingIdle(
			!this.canSelect() &&
				(this.session.phase === 'bot' ||
					this.session.countingIn ||
					this.session.paused ||
					(this.session.online && !this.network.onlineBegun) ||
					(this.session.online && !this.onlineHumanTurn())),
		);
		this.captureAvailable = legalMoves(this.session.position).some(
			(move) => move.path[0] && capturedOnSegment(this.session.position, move.from, move.path[0]),
		);
		this.paintPanelState();
		this.interaction.maybeAutoMove();
		this.paintUndo();
	}

	/**
	 * The rail belongs to a ready match: the field must be through the same
	 * reveal gate as the board with HUD (pack ready + first painted frame).
	 * Hidden rail, never a delayed move — input keeps its own timeline.
	 */
	private railConcealed(): boolean {
		return (
			this.session.phase === 'over' ||
			this.session.countingIn ||
			!this.playfieldReadyDone ||
			!this.boardPainted ||
			(!this.actionsEntered && this.hud?.isActionsReady?.() === false)
		);
	}
	private paintUndo(): void {
		this.actionsEntered =
			this.actions?.paint({
				phase: this.session.phase,
				online: this.session.online,
				paused: this.session.paused,
				flagLock: this.session.flagLock,
				undoDepth: this.session.botUndoStack.length,
				moving: this.session.moving,
				countingIn: this.session.countingIn,
				humanChain: Boolean(this.session.humanChain),
				concealed: this.railConcealed(),
				entered: this.actionsEntered,
				humanSide: this.session.humanSide,
				drawOffer: this.session.drawOffer,
				lastDrawOffer: this.session.lastDrawOffer,
				turn: this.session.position.turn,
				ply: this.session.online ? this.network.lastPly : this.session.matchPlies.length,
			}) ?? this.actionsEntered;
	}

	private endMatch(side: Side | 'draw', kind = 'rules'): void {
		if (
			!this.board ||
			this.session.acceptedResult ||
			this.session.phase === 'over'
		)
			return;
		performance.mark('damka:outcome-accepted');
		this.clock.banks = {
			white: this.sideRemainingMs('white'),
			black: this.sideRemainingMs('black'),
		};
		this.session.acceptedResult = {
			winner: side,
			humanSide: this.session.humanSide,
			online: this.session.online,
			reason: verdictReason(
				side,
				this.session.humanSide,
				kind,
				this.session.position,
				this.session.posKeys,
			),
		};
		this.session.resultKind = kind;
		this.bot.cancel();
		this.bot.pending = false;
		this.stopCountdown();
		this.board.clearOpeningHint();
		this.session.phase = 'over';
		this.session.selected = null;
		this.network.dropUntil = 0;
		this.paintClock();
		this.paintUndo();
		// Let an already accepted move land. No reset/sync interrupts capture or promotion.
		if (!this.session.moving) this.network.drainInbound();
	}
	private presentResult(): void {
		const result = this.session.acceptedResult;
		if (
			!result ||
			this.session.resultPresented ||
			this.session.moving ||
			this.session.phase !== 'over'
		)
			return;
		this.session.resultPresented = true;
		performance.mark('damka:result-move-settled');
		// Reasons depending on the position are read only after the final net ply commits.
		result.reason = verdictReason(
			result.winner,
			result.humanSide,
			this.session.resultKind,
			this.session.position,
			this.session.posKeys,
		);
		this.session.humanChain = null;
		this.board?.reset({
			keepPromotionFire: this.session.resultKind === 'rules',
		});
		this.refresh();
		const { winner: side } = result;
		if (side === 'draw') uiSfx('draw-result');
		if (side !== 'draw') {
			const line = orcOutcomeLine(
				this.session.resultKind === 'flag' ? 'flag' : 'rules',
				side === this.session.humanSide,
			);
			if (line === 'time-up')
				this.title?.speakOrcTurn(line, this.session.humanSide);
			else
				this.title?.resultSting(
					line === 'victory',
					line === 'victory' ? line : defeatTauntCue(this.session.humanSide),
					this.session.humanSide,
				);
		}
		if (!this.session.online && !this.session.preview) {
			void recordBotMatch({
				timeControl: this.clock.timeControl,
				humanSide: this.session.humanSide,
				winner: side,
				plies: this.session.matchPlies,
			});
		}
		const gen = this.session.resultGen;
		void this.ensureResultOverlay().then((overlay) => {
			if (gen !== this.session.resultGen || this.session.phase !== 'over')
				return;
			overlay?.show(result);
		});
	}

	private setPaused(paused: boolean): void {
		if (paused === this.session.paused) {
			return;
		}
		if (
			paused &&
			!this.session.countingIn &&
			(this.session.phase === 'human' || this.session.phase === 'bot')
		) {
			const side = this.session.position.turn;
			this.clock.banks[side] = remainingMs(
				this.clock.banks[side],
				this.clock.startedAt,
				this.time.now,
				false,
			);
		} else {
			this.clock.startedAt = this.time.now;
		}
		this.session.paused = paused;
		if (paused) {
			this.tweens.pauseAll();
		} else {
			this.tweens.resumeAll();
		}
		if (!paused && this.bot.pending) {
			this.interaction.playBot();
		}
		this.paintPanelState();
		this.paintUndo();
	}
}
