import Phaser from 'phaser';
import {
	pieceSprites,
} from '@/client/config/layout';
import { palette } from '@/client/config/palette';
import type { IBoardView } from '@/client/modules/board';
import { createBoardView } from '@/client/modules/board';
import { installDisplayDensity, logicalSize } from './displayDensity';
import { hopMovesForSelection } from '@/client/modules/board/parts/hopRays';
import { pickBotMove } from '@/client/modules/bot';
import captureUrl from '@/client/modules/sfx/capture.ogg';
import {
	createTableSfx,
	preloadTableSfx,
} from '@/client/modules/sfx/createTableSfx';
import flightUrl from '@/client/modules/sfx/hop/flight.ogg';
import hoverUrl from '@/client/modules/sfx/hop/hover.ogg';
import igniteUrl from '@/client/modules/sfx/hop/ignite.ogg';
import landUrl from '@/client/modules/sfx/hop/land.ogg';
import meadowUrl from '@/client/modules/sfx/meadow_loop.ogg';
import firstCaptureUrl from '@/client/modules/sfx/pervyy_vzryv.ogg';
import selectUrl from '@/client/modules/sfx/select.ogg';
import { sameSquare } from '@/client/shared/sameSquare';
import type { IMove, IPosition, ISquare, Side } from '@/rules';
import {
	afterMoveBank,
	apply,
	blitzStartMs,
	countdownBeatMs,
	countdownBeats,
	createInitialPosition,
	legalMoves,
	remainingMs,
	winner,
} from '@/rules';
import { hudFont } from '@/client/fonts/fonts';
import { createHud } from './createHud';
import { remainingForHud } from './matchClock';
import { createOpeningOverlay } from './openingOverlay';
import type { IYandexSdk } from './IYandexSdk';
import { getAutoMove } from './parts/createSfxPanel';
import { createResultOverlay } from './resultOverlay';
import hudAiUrl from './ui/hud_ai.png';
import hudAiOffUrl from './ui/hud_ai_off.png';
import hudClockFaceUrl from './ui/hud_clock_face.png';
import hudClockEIdleUrl from './ui/hud_clock_e_idle.png';
import hudClockEHotUrl from './ui/hud_clock_e_hot.png';
import hudClockEHot1Url from './ui/hud_clock_e_hot_1.png';
import hudClockEHot2Url from './ui/hud_clock_e_hot_2.png';
import hudClockEOkUrl from './ui/hud_clock_e_ok.png';
import hudClockEOk1Url from './ui/hud_clock_e_ok_1.png';
import hudClockEOk2Url from './ui/hud_clock_e_ok_2.png';
import hudNamePlankUrl from './ui/hud/hud_name_plank.png';
import hudClockGrassUrl from './ui/hud/hud_clock_grass.png';
import hudClockGrass01Url from './ui/hud/hud_clock_grass_01.png';
import hudClockGrass02Url from './ui/hud/hud_clock_grass_02.png';
import hudClockGrass03Url from './ui/hud/hud_clock_grass_03.png';
import hudGlassMeadowUrl from './ui/hud_glass_meadow.png';
import hudMenuUrl from './ui/hud_menu.png';
import hudMenuFoldUrl from './ui/hud_menu_fold.png';
import hudMenuOpenUrl from './ui/hud_menu_open.png';
import hudMenuPressUrl from './ui/hud_menu_press.png';
import hudMenuF0Url from './ui/hud_menu_f0.png';
import hudMenuF1Url from './ui/hud_menu_f1.png';
import hudMenuF2Url from './ui/hud_menu_f2.png';
import hudNoteUrl from './ui/hud_note.png';
import hudNoteOffUrl from './ui/hud_note_off.png';
import hudPlateUrl from './ui/hud_plate.png';
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
	private sfx!: ReturnType<typeof createTableSfx>;
	private position: IPosition = createInitialPosition();
	private selected: ISquare | null = null;
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
	private countText?: Phaser.GameObjects.Text;
	private countEvent?: Phaser.Time.TimerEvent;
	private botTimer?: Phaser.Time.TimerEvent;

	constructor() {
		super({ key: 'GameScene' });
	}

	private startupFailed = false;

	preload(): void {
		this.startupFailed = false;
		window.checkersStartup?.status('Загружаем доску, шашки и звук…');
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
		this.load.image('hudMenu', hudMenuUrl);
		this.load.image('hudMenuFold', hudMenuFoldUrl);
		this.load.image('hudMenuOpen', hudMenuOpenUrl);
		this.load.image('hudMenuPress', hudMenuPressUrl);
		this.load.image('hudMenuF0', hudMenuF0Url);
		this.load.image('hudMenuF1', hudMenuF1Url);
		this.load.image('hudMenuF2', hudMenuF2Url);
		this.load.image('hudGlassMeadow', hudGlassMeadowUrl);
		this.load.image('hudPlate', hudPlateUrl);
		this.load.image('hudNote', hudNoteUrl);
		this.load.image('hudNoteOff', hudNoteOffUrl);
		this.load.image('hudAi', hudAiUrl);
		this.load.image('hudAiOff', hudAiOffUrl);
		this.load.image('hudClockFace', hudClockFaceUrl);
		this.load.image('hudClockEIdle', hudClockEIdleUrl);
		this.load.image('hudClockEHot', hudClockEHotUrl);
		this.load.image('hudClockEHot1', hudClockEHot1Url);
		this.load.image('hudClockEHot2', hudClockEHot2Url);
		this.load.image('hudClockEOk', hudClockEOkUrl);
		this.load.image('hudClockEOk1', hudClockEOk1Url);
		this.load.image('hudClockEOk2', hudClockEOk2Url);
		this.load.image('hudNamePlank', hudNamePlankUrl);
		this.load.image('hudClockGrass', hudClockGrassUrl);
		this.load.image('hudClockGrass1', hudClockGrass01Url);
		this.load.image('hudClockGrass2', hudClockGrass02Url);
		this.load.image('hudClockGrass3', hudClockGrass03Url);
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
		preloadTableSfx(this, {
			select: selectUrl,
			hover: hoverUrl,
			ignite: igniteUrl,
			flight: flightUrl,
			land: landUrl,
			capture: captureUrl,
		});
	}

	create(): void {
		if (this.startupFailed) return;
		this.sdk = this.registry.get('sdk') as IYandexSdk;
		this.cameras.main.setBackgroundColor(palette.background);
		for (const key of [
			'hudMenu',
			'hudMenuOpen',
			'hudMenuFold',
			'hudMenuPress',
			'hudMenuF0',
			'hudMenuF1',
			'hudMenuF2',
			'hudGlassMeadow',
			'hudPlate',
			'hudNote',
			'hudNoteOff',
			'hudAi',
			'hudAiOff',
			'hudClockFace',
			'hudClockEIdle',
			'hudClockEHot',
			'hudClockEHot1',
			'hudClockEHot2',
			'hudClockEOk',
			'hudClockEOk1',
			'hudClockEOk2',
			'hudNamePlank',
			'hudClockGrass',
			'hudClockGrass1',
			'hudClockGrass2',
			'hudClockGrass3',
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
		this.sfx = createTableSfx(this, {
			meadow: meadowUrl,
			firstCapture: firstCaptureUrl,
		});
		this.hud = createHud(this, {
			onResign: () => {
				this.resignMatch();
			},
			onAutoChange: () => {
				this.refresh();
			},
		});
		this.hud.setVisible(false);
		this.countText = this.add
			.text(0, 0, '', {
				fontFamily: hudFont,
				fontSize: '48px',
				color: palette.text,
			})
			.setOrigin(0.5)
			.setDepth(40)
			.setVisible(false);
		this.board = createBoardView(this, (square) => {
			this.onSquare(square);
		}, () => {
			if (this.phase !== 'human' || this.paused || this.moving || this.countingIn) return;
			this.selected = null;
			this.sfx.stopHover();
			this.refresh();
		}, () => this.hud.isMenuOpen());
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
		this.sfx.stopHover();
		this.sfx.stopMeadow();
		this.title.show();
		this.sfx.startMeadow();
		this.refresh();
	}

	private startMatch(): void {
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
		this.sfx.stopMeadow();
		this.hud.setVisible(true);
		this.hud.setNames('Ты', 'Бот');
		this.board.setPlayfieldVisible(true);
		this.sfx.resetMatch();
		this.refresh();
		this.beginCountdown();
	}

	private stopCountdown(): void {
		this.countEvent?.remove(false);
		this.countEvent = undefined;
		this.countingIn = false;
		this.countText?.setVisible(false);
	}

	private beginCountdown(): void {
		this.stopCountdown();
		this.countingIn = true;
		this.countText?.setPosition(logicalSize(this).width / 2, logicalSize(this).height / 2);
		const step = (index: number): void => {
			if (!this.countingIn) {
				return;
			}
			const beat = countdownBeats[index];
			if (!beat) {
				this.stopCountdown();
				this.clockStartedAt = this.time.now;
				this.refresh();
				return;
			}
			this.countText?.setText(beat).setVisible(true);
			this.countEvent = this.time.delayedCall(countdownBeatMs, () => {
				step(index + 1);
			});
		};
		step(0);
	}

	private layout(width: number, height: number): void {
		this.board.layout(width, height);
		this.hud.layout(width, height);
		this.overlay.layout(width, height);
		this.title.layout(width, height);
		this.countText?.setPosition(width / 2, height / 2);
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
			this.position,
			this.humanHighlights(),
			this.selected,
			this.optionMoves(),
		);
		this.board.setWaitingIdle(
			this.phase === 'bot' || this.countingIn || this.paused,
		);
		this.hud.setTurn('');
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
		const moves = legalMoves(this.position);
		if (moves.length === 1) {
			this.playHuman(moves[0]);
		}
	}

	private optionMoves(): IMove[] {
		if (this.phase !== 'human' || this.paused || this.countingIn) {
			return [];
		}
		return hopMovesForSelection(legalMoves(this.position), this.selected);
	}

	private humanHighlights(): ISquare[] {
		if (this.phase !== 'human' || this.paused || this.countingIn) {
			return [];
		}
		const moves = legalMoves(this.position);
		const selected = this.selected;
		if (selected) {
			return uniqueSquares(
				moves
					.filter((move) => sameSquare(move.from, selected))
					.map((move) => move.path[move.path.length - 1]),
			);
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
			const chosen = moves.find(
				(move) =>
					sameSquare(move.from, selected) &&
					sameSquare(move.path[move.path.length - 1], square),
			);
			if (chosen) {
				this.playHuman(chosen);
				return;
			}
		}
		if (moves.some((move) => sameSquare(move.from, square))) {
			this.selected = square;
			this.sfx.selectThenHover();
			this.refresh();
			return;
		}
		const piece = this.position.squares[square.row][square.col];
		const denied = Boolean(piece && piece.side === this.position.turn);
		this.selected = null;
		this.sfx.stopHover();
		this.refresh();
		if (denied) {
			this.board.deny(square);
		}
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
			(took) => {
				this.sfx.land(took);
			},
			(took) => {
				this.sfx.takeoff(took);
			},
		);
	}

	private playHuman(move: IMove): void {
		this.animateMove(move, () => {
			const mover = this.position.turn;
			const next = apply(this.position, move);
			if (!next) {
				return;
			}
			this.settleClock(mover);
			this.position = next;
			this.board.notePly();
			const side = winner(this.position);
			if (side) {
				this.endMatch(side);
				return;
			}
			this.phase = 'bot';
			this.refresh();
			this.botTimer?.remove(false);
			this.botTimer = this.time.delayedCall(400, () => {
				this.playBot();
			});
		});
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

	private resignMatch(): void {
		if (this.paused || this.moving || this.flagLock || this.phase !== 'human') {
			return;
		}
		this.phase = 'over';
		this.selected = null;
		this.sfx.stopHover();
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
		if (paused) {
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
		this.sound.mute = paused;
		this.sfx.setPaused(paused);
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
