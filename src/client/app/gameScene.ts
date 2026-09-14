import Phaser from 'phaser';
import {
	pieceSprites,
} from '@/client/config/layout';
import { palette } from '@/client/config/palette';
import type { IBoardView } from '@/client/modules/board';
import { createBoardView } from '@/client/modules/board';
import { installDisplayDensity, logicalSize } from './displayDensity';
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
import mascotIdle0Url from './ui/result/mascot_idle_00.png';
import mascotIdle1Url from './ui/result/mascot_idle_01.png';
import mascotIdle2Url from './ui/result/mascot_idle_02.png';
import mascotIdle3Url from './ui/result/mascot_idle_03.png';
import mascotWin0Url from './ui/result/mascot_win_00.png';
import mascotWin1Url from './ui/result/mascot_win_01.png';
import mascotWin2Url from './ui/result/mascot_win_02.png';
import mascotWin3Url from './ui/result/mascot_win_03.png';
import mascotWin4Url from './ui/result/mascot_win_04.png';
import resultBtnUrl from './ui/result/result_btn.png';
import resultGlassWinUrl from './ui/result/result_glass_win.png';
import resultMonitorUrl from './ui/result/result_monitor.png';
import defeatTerminalUrl from './ui/result/terminal_sockets.png';
import primaryRestUrl from './ui/result/primary_rest.png';
import primaryPressedUrl from './ui/result/primary_pressed.png';
import secondaryRestUrl from './ui/result/secondary_rest.png';
import secondaryPressedUrl from './ui/result/secondary_pressed.png';

export class GameScene extends Phaser.Scene {
	// The current bot mode always assigns the human white.
	private readonly humanSide: Side = 'white';
	private board!: IBoardView;
	private hud!: ReturnType<typeof createHud>;
	private overlay!: ReturnType<typeof createResultOverlay>;
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

	private botTimer?: Phaser.Time.TimerEvent;

	constructor() {
		super({ key: 'GameScene' });
	}

	private startupFailed = false;

	preload(): void {
		this.startupFailed = false;
		window.checkersStartup?.status('Загружаем доску и шашки…');
		this.load.on('loaderror', () => {
			this.startupFailed = true;
			clearTimeout(window.checkersStartup?.watchdog);
			window.checkersStartup?.fail('Не удалось загрузить игровые ресурсы. Проверьте соединение и повторите загрузку.');
		});
		// Share exact lossless delivery copies with the HTML opening; keep PNG masters untouched.
		const reliquaryAssets: Record<string, unknown> = {
			...import.meta.glob(['../modules/board/reliquary/*.png', '!../modules/board/reliquary/black_disk.png', '!../modules/board/reliquary/ivory_disk.png'], { eager: true, query: '?url', import: 'default' }),
			'../modules/board/reliquary/black_disk.png': new URL('./ui/opening/black_disk.webp', import.meta.url).href,
			'../modules/board/reliquary/ivory_disk.png': new URL('./ui/opening/ivory_disk.webp', import.meta.url).href,
		};
		for(const [path,url] of Object.entries(reliquaryAssets)) {
			const name=path.split('/').pop()!.replace('.png','');
			this.load.image(`reliquary_${name}`,url as string);
		}
		this.load.image('defeatTerminal', defeatTerminalUrl);
		this.load.image('defeat_primary_rest', primaryRestUrl);
		this.load.image('defeat_primary_pressed', primaryPressedUrl);
		this.load.image('defeat_secondary_rest', secondaryRestUrl);
		this.load.image('defeat_secondary_pressed', secondaryPressedUrl);
		const defeatFrames = import.meta.glob('./ui/result/checker-defeat/*.png', {
			eager: true, query: '?url', import: 'default',
		});
		for (const [path, url] of Object.entries(defeatFrames)) {
			const frame = path.split('/').pop()!.replace('.png', '');
			this.load.image(`checkerDefeat_${frame}`, url as string);
		}
		this.load.image(pieceSprites.manLight, reliquaryAssets['../modules/board/reliquary/ivory_disk.png'] as string);
		this.load.image(pieceSprites.manDark, reliquaryAssets['../modules/board/reliquary/black_disk.png'] as string);
		this.load.image(pieceSprites.kingLight, reliquaryAssets['../modules/board/reliquary/ivory_king.png'] as string);
		this.load.image(pieceSprites.kingDark, reliquaryAssets['../modules/board/reliquary/black_king.png'] as string);
		preloadBunkerPanels(this);

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

	create(): void {
		if (this.startupFailed) return;
		this.sdk = this.registry.get('sdk') as IYandexSdk;
		this.cameras.main.setBackgroundColor(palette.background);
		for (const key of [
			'resultMonitor',
			'mascotIdle0',
			'mascotIdle1',
			'mascotIdle2',
			'mascotIdle3',
		]) {
			if (!this.textures.exists(key)) {
				continue;
			}
			this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
		}
		this.hud = createHud(this, {
			isPaused: () => this.paused,
			onAutoChange: () => {
				this.refresh();
			},
		});
		this.hud.setVisible(false);

		this.board = createBoardView(this, (square) => {
			this.onSquare(square);
		}, () => this.cancelSelection(), () => this.hud.isMenuOpen());
		this.board.setPlayfieldVisible(false);
		this.title = createOpeningOverlay(this, {
			onPlayBot: () => {
				this.startMatch();
			},
		});
		this.overlay = createResultOverlay(this, {
			onPlayAgain: () => {
				this.startMatch();
			},
			onMenu: () => {
				this.showTitle();
			},
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
		this.board.layout(logicalSize(this).width, logicalSize(this).height);
		this.hud.layout(logicalSize(this).width, logicalSize(this).height);
		this.overlay.layout(logicalSize(this).width, logicalSize(this).height);
		this.title.layout(logicalSize(this).width, logicalSize(this).height);
		this.showTitle();
		this.sdk.ready();
	}

	private showTitle(): void {
		this.humanChain = null;
		this.botTimer?.remove(false);
		this.tweens.killAll();
		this.board.reset();
		this.moving = false;
		this.position = createInitialPosition();
		this.selected = null;
		this.phase = 'title';
		this.pendingBot = false;
		this.overlay.hide();
		this.hud.setVisible(false);
		this.stopCountdown();
		this.board.setPlayfieldVisible(false);
		this.title.show();
		this.refresh();
	}

	private startMatch(): void {
		this.stopCountdown();
		this.countingIn = true;
		this.humanChain = null;
		this.botTimer?.remove(false);
		this.tweens.killAll();
		this.board.reset();
		this.moving = false;
		this.position = createInitialPosition();
		this.selected = null;
		this.phase = 'human';
		this.pendingBot = false;
		this.elapsedMs = 0;
		this.runningSince = this.time.now;
		this.clocks = { white: blitzStartMs, black: blitzStartMs };
		this.clockStartedAt = 0;
		this.flagLock = false;

		this.hud.setClock(
			Math.ceil(blitzStartMs / 1000),
			Math.ceil(blitzStartMs / 1000),
		);
		this.title.hide();
		this.overlay.hide();
		this.hud.setVisible(true);
		this.hud.setNames('Ты', 'Бот');
		this.board.setPlayfieldVisible(true);
		this.beginCountdown();
		this.refresh();
	}

	private stopCountdown(): void {
		this.hud?.stopReveal();
		this.countingIn = false;
	}

	private beginCountdown(): void {
		this.stopCountdown();
		this.countingIn = true;
		this.hud.startReveal(() => {
			if (!this.countingIn) return;
			// One authoritative boundary: input and the active bank become live together.
			this.clockStartedAt = this.time.now;
			this.countingIn = false;
			this.paintClock();
			this.refresh();
		});
	}

	private layout(width: number, height: number): void {
		this.board.layout(width, height);
		this.hud.layout(width, height);
		this.overlay.layout(width, height);
		this.title.layout(width, height);

		this.refresh();
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
		this.hud.setClock(
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
		if (this.flagLock || this.moving || this.countingIn || this.phase === 'over') {
			return;
		}
		this.flagLock = true;
		const loser = this.position.turn;
		const won = loser === 'white' ? 'black' : 'white';
		this.endMatch(won);
	}

	private refresh(): void {
		if (this.phase === 'title') {
			this.hud.setTurn('');
			return;
		}
		this.board.sync(
			this.humanChain?.visualPosition ?? this.position,
			this.humanHighlights(),
			this.selected,
			this.optionMoves(),
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
			this.selected = square;
			this.refresh();
			return;
		}
		const piece = this.position.squares[square.row][square.col];
		const denied = Boolean(piece && piece.side === this.position.turn);
		this.selected = null;
		this.refresh();
		if (denied) {
			this.board.deny(square);
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
		const visual = chain.visualPosition;
		const chosen = chain.choose(square);
		if (!chosen) return false;
		this.humanChain = chain;
		this.moving = true;
		this.board.sync(visual, [], null);
		this.board.playMove(chosen.hop, () => {
			this.moving = false;
			this.selected = chain.selected;
			// Time runs through hops and branch decisions; a final tap cannot rescue a flag.
			if (this.sideRemainingMs(this.position.turn) <= 0) {
				this.onFlag();
				return;
			}
			if (chosen.complete) this.completeHumanMove(chosen.complete);
			else this.refresh();
		}, undefined, undefined, true);
		return true;
	}

	private animateMove(move: IMove, after: () => void): void {
		this.moving = true;
		this.selected = null;
		this.board.sync(this.position, [], null);
		this.board.playMove(
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
		this.position = next;
		this.humanChain = null;
		this.selected = null;
		this.board.notePly();
		const side = winner(this.position);
		if (side) {
			this.endMatch(side);
			return;
		}
		this.phase = 'bot';
		this.refresh();
		this.botTimer?.remove(false);
		this.botTimer = this.time.delayedCall(400, () => this.playBot());
	}

	private playBot(): void {
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
		if (this.paused || this.moving || this.flagLock || this.phase !== 'human') {
			return;
		}
		this.phase = 'over';
		this.selected = null;
		this.refresh();
		this.overlay.show('black', this.humanSide);
	}

	private endMatch(side: Side): void {
		this.phase = 'over';
		this.selected = null;
		this.refresh();
		this.sdk.showFullscreenAdv({
			onClose: () => {
				this.overlay.show(side, this.humanSide);
			},
			onError: () => {
				this.overlay.show(side, this.humanSide);
			},
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
