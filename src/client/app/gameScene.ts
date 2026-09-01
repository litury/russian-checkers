import Phaser from 'phaser';
import {
	boardSprite,
	layout,
	pieceSprites,
	tableBgs,
} from '@/client/config/layout';
import { palette } from '@/client/config/palette';
import type { IBoardView } from '@/client/modules/board';
import { createBoardView } from '@/client/modules/board';
import bg169Url from '@/client/modules/board/bg169_hole.png';
import bg916Url from '@/client/modules/board/bg916_hole.png';
import board8Url from '@/client/modules/board/board8.png';
import moveRingUrl from '@/client/modules/board/move_ring.png';
import kingDarkUrl from '@/client/modules/board/pieces/king_dark.png';
import kingLightUrl from '@/client/modules/board/pieces/king_light.png';
import manDarkUrl from '@/client/modules/board/pieces/man_dark.png';
import manLightUrl from '@/client/modules/board/pieces/man_light.png';
import selectRingUrl from '@/client/modules/board/select_ring.png';
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
		this.load.image(boardSprite.key, board8Url);
		this.load.image(tableBgs.portrait.key, bg916Url);
		this.load.image(tableBgs.landscape.key, bg169Url);
		this.load.image(pieceSprites.manLight, manLightUrl);
		this.load.image(pieceSprites.manDark, manDarkUrl);
		this.load.image(pieceSprites.kingLight, kingLightUrl);
		this.load.image(pieceSprites.kingDark, kingDarkUrl);
		this.load.image(pieceSprites.moveRing, moveRingUrl);
		this.load.image(pieceSprites.selectRing, selectRingUrl);
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
