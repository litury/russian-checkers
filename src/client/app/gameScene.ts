import Phaser from 'phaser';
import {
	debrisSprites,
	fireSprites,
	pieceSprites,
	pitSprites,
	tableLayers,
	wreathSprites,
} from '@/client/config/layout';
import { palette } from '@/client/config/palette';
import type { IBoardView } from '@/client/modules/board';
import { createBoardView } from '@/client/modules/board';
import tongue0IdleUrl from '@/client/modules/board/fire_rocket/tongue_0_idle.png';
import tongue0LandUrl from '@/client/modules/board/fire_rocket/tongue_0_land.png';
import tongue0UpUrl from '@/client/modules/board/fire_rocket/tongue_0_up.png';
import tongue1IdleUrl from '@/client/modules/board/fire_rocket/tongue_1_idle.png';
import tongue1LandUrl from '@/client/modules/board/fire_rocket/tongue_1_land.png';
import tongue1UpUrl from '@/client/modules/board/fire_rocket/tongue_1_up.png';
import tongue2IdleUrl from '@/client/modules/board/fire_rocket/tongue_2_idle.png';
import tongue2LandUrl from '@/client/modules/board/fire_rocket/tongue_2_land.png';
import tongue2UpUrl from '@/client/modules/board/fire_rocket/tongue_2_up.png';
import emberUrl from '@/client/modules/board/kit_v2/fx/ember.png';
import puff0Url from '@/client/modules/board/kit_v2/fx/puff_0.png';
import puff1Url from '@/client/modules/board/kit_v2/fx/puff_1.png';
import puff2Url from '@/client/modules/board/kit_v2/fx/puff_2.png';
import kingDarkUrl from '@/client/modules/board/pieces/king_dark.png';
import kingLightUrl from '@/client/modules/board/pieces/king_light.png';
import manDarkUrl from '@/client/modules/board/pieces/man_dark.png';
import manLightUrl from '@/client/modules/board/pieces/man_light.png';
import debrisStoneGmUrl from '@/client/modules/board/table_layers/debris_grass_stone_gm.png';
import debrisStonePlUrl from '@/client/modules/board/table_layers/debris_grass_stone_pl.png';
import earthGrassUrl from '@/client/modules/board/table_layers/earth_grass.png';
import pitGrass00Url from '@/client/modules/board/table_layers/pit_grass_00.png';
import pitGrass01Url from '@/client/modules/board/table_layers/pit_grass_01.png';
import pitGrass02Url from '@/client/modules/board/table_layers/pit_grass_02.png';
import pitGrass03Url from '@/client/modules/board/table_layers/pit_grass_03.png';
import pitGrass04Url from '@/client/modules/board/table_layers/pit_grass_04.png';
import pitGrass05Url from '@/client/modules/board/table_layers/pit_grass_05.png';
import pitGrass06Url from '@/client/modules/board/table_layers/pit_grass_06.png';
import pitGrass07Url from '@/client/modules/board/table_layers/pit_grass_07.png';
import selectMaskUrl from '@/client/modules/board/table_layers/select_mask.png';
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
import selectUrl from '@/client/modules/sfx/select.ogg';
import { sameSquare } from '@/client/shared/sameSquare';
import type { IMove, IPosition, ISquare, Side } from '@/rules';
import { apply, createInitialPosition, legalMoves, winner } from '@/rules';
import { createHud } from './createHud';
import type { IYandexSdk } from './IYandexSdk';
import { createResultOverlay } from './resultOverlay';
import hudMenuUrl from './ui/hud_menu.png';
import mascotLoseUrl from './ui/result/mascot_lose.png';
import mascotWin0Url from './ui/result/mascot_win_00.png';
import mascotWin1Url from './ui/result/mascot_win_01.png';
import mascotWin2Url from './ui/result/mascot_win_02.png';
import mascotWin3Url from './ui/result/mascot_win_03.png';
import mascotWin4Url from './ui/result/mascot_win_04.png';
import resultBtnUrl from './ui/result/result_btn.png';
import resultGlassLoseUrl from './ui/result/result_glass_lose.png';
import resultGlassWinUrl from './ui/result/result_glass_win.png';
import resultMonitorUrl from './ui/result/result_monitor.png';

export class GameScene extends Phaser.Scene {
	private board!: IBoardView;
	private hud!: ReturnType<typeof createHud>;
	private overlay!: ReturnType<typeof createResultOverlay>;
	private sdk!: IYandexSdk;
	private sfx!: ReturnType<typeof createTableSfx>;
	private position: IPosition = createInitialPosition();
	private selected: ISquare | null = null;
	private phase: 'human' | 'bot' | 'over' = 'human';
	private paused = false;
	private pendingBot = false;
	private moving = false;
	private elapsedMs = 0;
	private runningSince = 0;
	private botTimer?: Phaser.Time.TimerEvent;

	constructor() {
		super({ key: 'GameScene' });
	}

	preload(): void {
		this.load.image(tableLayers.earth, earthGrassUrl);
		this.load.image(pitSprites.keys[0], pitGrass00Url);
		this.load.image(pitSprites.keys[1], pitGrass01Url);
		this.load.image(pitSprites.keys[2], pitGrass02Url);
		this.load.image(pitSprites.keys[3], pitGrass03Url);
		this.load.image(pitSprites.keys[4], pitGrass04Url);
		this.load.image(pitSprites.keys[5], pitGrass05Url);
		this.load.image(pitSprites.keys[6], pitGrass06Url);
		this.load.image(pitSprites.keys[7], pitGrass07Url);
		this.load.image(debrisSprites.stonePl, debrisStonePlUrl);
		this.load.image(debrisSprites.stoneGm, debrisStoneGmUrl);
		this.load.image(pieceSprites.manLight, manLightUrl);
		this.load.image(pieceSprites.manDark, manDarkUrl);
		this.load.image(pieceSprites.kingLight, kingLightUrl);
		this.load.image(pieceSprites.kingDark, kingDarkUrl);
		this.load.image(wreathSprites.mask, selectMaskUrl);
		this.load.image(fireSprites.ember, emberUrl);
		this.load.image(fireSprites.idle[0], tongue0IdleUrl);
		this.load.image(fireSprites.idle[1], tongue1IdleUrl);
		this.load.image(fireSprites.idle[2], tongue2IdleUrl);
		this.load.image(fireSprites.up[0], tongue0UpUrl);
		this.load.image(fireSprites.up[1], tongue1UpUrl);
		this.load.image(fireSprites.up[2], tongue2UpUrl);
		this.load.image(fireSprites.land[0], tongue0LandUrl);
		this.load.image(fireSprites.land[1], tongue1LandUrl);
		this.load.image(fireSprites.land[2], tongue2LandUrl);
		this.load.image(fireSprites.puffs[0], puff0Url);
		this.load.image(fireSprites.puffs[1], puff1Url);
		this.load.image(fireSprites.puffs[2], puff2Url);
		this.load.image('hudMenu', hudMenuUrl);
		this.load.image('resultMonitor', resultMonitorUrl);
		this.load.image('resultGlassWin', resultGlassWinUrl);
		this.load.image('resultGlassLose', resultGlassLoseUrl);
		this.load.image('resultBtn', resultBtnUrl);
		this.load.image('mascotLose', mascotLoseUrl);
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
		this.sdk = this.registry.get('sdk') as IYandexSdk;
		this.cameras.main.setBackgroundColor(palette.background);
		this.sfx = createTableSfx(this);
		this.hud = createHud(this);
		this.board = createBoardView(this, (square) => {
			this.onSquare(square);
		});
		this.overlay = createResultOverlay(this, () => {
			this.startMatch();
		});
		this.sdk.onPause(() => {
			this.setPaused(true);
		});
		this.sdk.onResume(() => {
			this.setPaused(false);
		});
		this.scale.on('resize', (gameSize: { width: number; height: number }) => {
			this.layout(gameSize.width, gameSize.height);
		});
		this.time.addEvent({
			delay: 1000,
			loop: true,
			callback: () => {
				this.hud.setTimer(this.matchSeconds());
			},
		});
		this.startMatch();
		this.layout(this.scale.width, this.scale.height);
		this.sdk.ready();
	}

	private startMatch(): void {
		this.botTimer?.remove(false);
		this.tweens.killAll();
		this.moving = false;
		this.position = createInitialPosition();
		this.selected = null;
		this.phase = 'human';
		this.pendingBot = false;
		this.elapsedMs = 0;
		this.runningSince = this.time.now;
		this.hud.setTimer(0);
		this.overlay.hide();
		this.sfx.stopHover();
		this.refresh();
	}

	private layout(width: number, height: number): void {
		this.board.layout(width, height);
		this.hud.layout(width, height);
		this.overlay.layout(width, height);
		this.refresh();
	}

	private matchSeconds(): number {
		const extra = this.paused ? 0 : this.time.now - this.runningSince;
		return Math.floor((this.elapsedMs + extra) / 1000);
	}

	private refresh(): void {
		this.board.sync(this.position, this.humanHighlights(), this.selected);
		if (this.phase === 'human') {
			this.hud.setTurn('Ваш ход');
		} else if (this.phase === 'bot') {
			this.hud.setTurn('Ход соперника');
		} else {
			this.hud.setTurn('');
		}
	}

	private humanHighlights(): ISquare[] {
		if (this.phase !== 'human' || this.paused) {
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
		if (this.paused || this.moving || this.phase !== 'human') {
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
			() => {
				this.sfx.takeoff();
			},
		);
	}

	private playHuman(move: IMove): void {
		this.animateMove(move, () => {
			const next = apply(this.position, move);
			if (!next) {
				return;
			}
			this.position = next;
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
			const next = apply(this.position, move);
			if (!next) {
				this.endMatch(winner(this.position) ?? 'white');
				return;
			}
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

	private endMatch(side: Side): void {
		this.phase = 'over';
		this.selected = null;
		this.refresh();
		this.sdk.showFullscreenAdv({
			onClose: () => {
				this.overlay.show(side);
			},
			onError: () => {
				this.overlay.show(side);
			},
		});
	}

	private setPaused(paused: boolean): void {
		if (paused === this.paused) {
			return;
		}
		if (paused) {
			this.elapsedMs += this.time.now - this.runningSince;
		} else {
			this.runningSince = this.time.now;
		}
		this.paused = paused;
		this.sound.mute = paused;
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
