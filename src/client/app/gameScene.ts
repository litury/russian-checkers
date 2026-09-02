import Phaser from 'phaser';
import {
	debrisSprites,
	layout,
	pieceSprites,
	pitSprites,
	tableLayers,
} from '@/client/config/layout';
import { palette } from '@/client/config/palette';
import type { IBoardView } from '@/client/modules/board';
import { createBoardView } from '@/client/modules/board';
import captureRimUrl from '@/client/modules/board/kit_v2/capture_rim.png';
import moveRimUrl from '@/client/modules/board/kit_v2/move_rim.png';
import selectRimUrl from '@/client/modules/board/kit_v2/select_rim.png';
import kingDarkUrl from '@/client/modules/board/pieces/king_dark.png';
import kingLightUrl from '@/client/modules/board/pieces/king_light.png';
import manDarkUrl from '@/client/modules/board/pieces/man_dark.png';
import manLightUrl from '@/client/modules/board/pieces/man_light.png';
import debrisMossUrl from '@/client/modules/board/table_layers/debris_grass_moss.png';
import debrisStoneGmUrl from '@/client/modules/board/table_layers/debris_grass_stone_gm.png';
import debrisStonePlUrl from '@/client/modules/board/table_layers/debris_grass_stone_pl.png';
import debrisTuftUrl from '@/client/modules/board/table_layers/debris_grass_tuft.png';
import earthGrassUrl from '@/client/modules/board/table_layers/earth_grass.png';
import pitGrass00Url from '@/client/modules/board/table_layers/pit_grass_00.png';
import pitGrass01Url from '@/client/modules/board/table_layers/pit_grass_01.png';
import pitGrass02Url from '@/client/modules/board/table_layers/pit_grass_02.png';
import pitGrass03Url from '@/client/modules/board/table_layers/pit_grass_03.png';
import pitGrass04Url from '@/client/modules/board/table_layers/pit_grass_04.png';
import pitGrass05Url from '@/client/modules/board/table_layers/pit_grass_05.png';
import pitGrass06Url from '@/client/modules/board/table_layers/pit_grass_06.png';
import pitGrass07Url from '@/client/modules/board/table_layers/pit_grass_07.png';
import { pickBotMove } from '@/client/modules/bot';
import captureUrl from '@/client/modules/sfx/capture.ogg';
import {
	createTableSfx,
	preloadTableSfx,
} from '@/client/modules/sfx/createTableSfx';
import moveUrl from '@/client/modules/sfx/move.ogg';
import selectUrl from '@/client/modules/sfx/select.ogg';
import { sameSquare } from '@/client/shared/sameSquare';
import type { IMove, IPosition, ISquare, Side } from '@/rules';
import { apply, createInitialPosition, legalMoves, winner } from '@/rules';
import type { IYandexSdk } from './IYandexSdk';
import { createResultOverlay } from './resultOverlay';

export class GameScene extends Phaser.Scene {
	private board!: IBoardView;
	private overlay!: { show: (side: Side) => void; hide: () => void };
	private sdk!: IYandexSdk;
	private sfx!: { play: (kind: 'select' | 'move' | 'capture') => void };
	private position: IPosition = createInitialPosition();
	private selected: ISquare | null = null;
	private phase: 'human' | 'bot' | 'over' = 'human';
	private paused = false;
	private pendingBot = false;
	private moving = false;
	private status!: Phaser.GameObjects.Text;
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
		this.load.image(debrisSprites.tuft, debrisTuftUrl);
		this.load.image(debrisSprites.moss, debrisMossUrl);
		this.load.image(debrisSprites.stonePl, debrisStonePlUrl);
		this.load.image(debrisSprites.stoneGm, debrisStoneGmUrl);
		this.load.image(pieceSprites.manLight, manLightUrl);
		this.load.image(pieceSprites.manDark, manDarkUrl);
		this.load.image(pieceSprites.kingLight, kingLightUrl);
		this.load.image(pieceSprites.kingDark, kingDarkUrl);
		this.load.image(pieceSprites.selectRim, selectRimUrl);
		this.load.image(pieceSprites.moveRim, moveRimUrl);
		this.load.image(pieceSprites.captureRim, captureRimUrl);
		preloadTableSfx(this, {
			select: selectUrl,
			move: moveUrl,
			capture: captureUrl,
		});
	}

	create(): void {
		this.sdk = this.registry.get('sdk') as IYandexSdk;
		this.cameras.main.setBackgroundColor(palette.background);
		this.sfx = createTableSfx(this);
		this.status = this.add
			.text(0, 18, '', {
				fontFamily: 'Arial, sans-serif',
				fontSize: '20px',
				color: palette.text,
			})
			.setOrigin(0.5, 0.5)
			.setDepth(20);
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
		this.overlay.hide();
		this.refresh();
	}

	private layout(width: number, height: number): void {
		this.status.setPosition(width / 2, layout.statusHeight / 2);
		this.board.layout(width, height);
		this.refresh();
	}

	private refresh(): void {
		this.board.sync(this.position, this.humanHighlights(), this.selected);
		if (this.phase === 'human') {
			this.status.setText('Ваш ход');
		} else if (this.phase === 'bot') {
			this.status.setText('Ход соперника');
		} else {
			this.status.setText('');
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
			this.sfx.play('select');
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
				this.sfx.play(took ? 'capture' : 'move');
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
