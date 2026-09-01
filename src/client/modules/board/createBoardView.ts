import type Phaser from 'phaser';
import { layout, pieceSprites, tableSprite } from '@/client/config/layout';
import { palette } from '@/client/config/palette';
import { sameSquare } from '@/client/shared/sameSquare';
import type { IMove, IPosition, ISquare } from '@/rules';
import type { IBoardView } from './IBoardView';

function squareKey(square: ISquare): string {
	return `${square.row},${square.col}`;
}

function pieceKey(side: 'white' | 'black', kind: 'man' | 'king'): string {
	if (kind === 'king') {
		return side === 'white' ? pieceSprites.kingLight : pieceSprites.kingDark;
	}
	return side === 'white' ? pieceSprites.manLight : pieceSprites.manDark;
}

function isJump(from: ISquare, to: ISquare): boolean {
	return Math.abs(to.row - from.row) > 1;
}

function squaresAlong(from: ISquare, to: ISquare): ISquare[] {
	const rowDelta = to.row - from.row;
	const colDelta = to.col - from.col;
	const steps = Math.abs(rowDelta);
	if (steps === 0 || steps !== Math.abs(colDelta)) {
		return [];
	}
	const dirRow = Math.sign(rowDelta);
	const dirCol = Math.sign(colDelta);
	const between: ISquare[] = [];
	for (let i = 1; i < steps; i += 1) {
		between.push({ row: from.row + dirRow * i, col: from.col + dirCol * i });
	}
	return between;
}

type PieceView = {
	square: ISquare;
	sprite: Phaser.GameObjects.Image;
	shadow: Phaser.GameObjects.Ellipse;
	baseScale: number;
};

export function createBoardView(
	scene: Phaser.Scene,
	onSquare: (square: ISquare) => void,
): IBoardView {
	const table = scene.add.image(0, 0, tableSprite.key);
	table.setOrigin(0, 0);
	table.setDepth(0);
	const squares: {
		row: number;
		col: number;
		rect: Phaser.GameObjects.Rectangle;
	}[] = [];
	const markers: Phaser.GameObjects.Rectangle[] = [];
	const pieceViews = new Map<string, PieceView>();
	const grid = scene.add.graphics();
	grid.setDepth(1);
	let originX = 0;
	let originY = 0;
	let cellW = 0;
	let cellH = 0;
	let moving = false;
	let pulsing: PieceView | null = null;
	let denyFill: Phaser.GameObjects.Rectangle | null = null;

	for (let row = 0; row < layout.rankCount; row += 1) {
		for (let col = 0; col < layout.rankCount; col += 1) {
			const rect = scene.add.rectangle(0, 0, 8, 8, palette.darkSquare, 0);
			rect.setDepth(2);
			rect.setInteractive();
			rect.on('pointerdown', () => {
				press({ row, col });
				onSquare({ row, col });
			});
			squares.push({ row, col, rect });
		}
	}

	function cellBox(square: ISquare): {
		x: number;
		y: number;
		w: number;
		h: number;
	} {
		const visRow = layout.rankCount - 1 - square.row;
		const left = Math.round(originX + square.col * cellW);
		const right = Math.round(originX + (square.col + 1) * cellW);
		const top = Math.round(originY + visRow * cellH);
		const bottom = Math.round(originY + (visRow + 1) * cellH);
		return {
			x: (left + right) / 2,
			y: (top + bottom) / 2,
			w: right - left,
			h: bottom - top,
		};
	}

	function clearDeny(): void {
		if (!denyFill) {
			return;
		}
		scene.tweens.killTweensOf(denyFill);
		denyFill.destroy();
		denyFill = null;
	}

	function clearMarkers(): void {
		clearDeny();
		for (const marker of markers) {
			scene.tweens.killTweensOf(marker);
			marker.destroy();
		}
		markers.length = 0;
	}

	function drawGrid(): void {
		grid.clear();
		if (!layout.debugGrid) {
			return;
		}
		grid.lineStyle(1, palette.selected, 0.85);
		for (let i = 0; i <= layout.rankCount; i += 1) {
			const x = originX + i * cellW;
			const y = originY + i * cellH;
			grid.lineBetween(originX, y, originX + cellW * layout.rankCount, y);
			grid.lineBetween(x, originY, x, originY + cellH * layout.rankCount);
		}
	}

	function placeShadow(view: PieceView, selected: boolean): void {
		const box = cellBox(view.square);
		const cell = Math.min(box.w, box.h);
		view.shadow.setPosition(box.x, box.y + cell * 0.12);
		view.shadow.setSize(box.w * 0.62, box.h * 0.22);
		view.shadow.setDepth(3);
		view.shadow.setVisible(selected);
		view.shadow.setAlpha(selected ? layout.shadowAlpha : 0);
	}

	function placePiece(view: PieceView, selected: boolean): void {
		const box = cellBox(view.square);
		const size = Math.min(box.w, box.h);
		view.baseScale = size / pieceSprites.size;
		view.sprite.setPosition(box.x, box.y);
		view.sprite.setScale(view.baseScale);
		view.sprite.setDepth(selected ? 5 : 4);
		placeShadow(view, selected);
	}

	function stopPulse(view: PieceView | null): void {
		if (!view) {
			return;
		}
		scene.tweens.killTweensOf(view.sprite);
		scene.tweens.killTweensOf(view.shadow);
		if (pulsing === view) {
			pulsing = null;
		}
	}

	function destroyView(view: PieceView): void {
		stopPulse(view);
		view.sprite.destroy();
		view.shadow.destroy();
	}

	function startPulse(view: PieceView): void {
		const box = cellBox(view.square);
		stopPulse(pulsing === view ? view : pulsing);
		stopPulse(view);
		pulsing = view;
		view.sprite.setDepth(5);
		view.sprite.setPosition(box.x, box.y);
		view.sprite.setScale(view.baseScale);
		view.shadow.setVisible(true);
		view.shadow.setAlpha(0);
		scene.tweens.add({
			targets: view.shadow,
			alpha: layout.shadowAlpha,
			duration: layout.selectMs,
			ease: 'Sine.easeOut',
		});
	}

	function reconcile(position: IPosition, selected: ISquare | null): void {
		const seen = new Set<string>();
		for (let row = 0; row < layout.rankCount; row += 1) {
			for (let col = 0; col < layout.rankCount; col += 1) {
				const piece = position.squares[row][col];
				if (!piece) {
					continue;
				}
				const square = { row, col };
				const key = squareKey(square);
				seen.add(key);
				let view = pieceViews.get(key);
				const texture = pieceKey(piece.side, piece.kind);
				if (!view) {
					const sprite = scene.add.image(0, 0, texture);
					sprite.setDepth(4);
					const shadow = scene.add.ellipse(0, 0, 8, 8, 0x000000, 1);
					shadow.setDepth(3);
					shadow.setAlpha(0);
					shadow.setVisible(false);
					view = { square, sprite, shadow, baseScale: 1 };
					pieceViews.set(key, view);
				} else {
					view.square = square;
					if (view.sprite.texture.key !== texture) {
						view.sprite.setTexture(texture);
					}
				}
				placePiece(view, Boolean(selected && sameSquare(square, selected)));
			}
		}
		for (const [key, view] of pieceViews) {
			if (!seen.has(key)) {
				destroyView(view);
				pieceViews.delete(key);
			}
		}
	}

	function paintFill(
		square: ISquare,
		color: number,
	): Phaser.GameObjects.Rectangle {
		const box = cellBox(square);
		const fill = scene.add.rectangle(
			box.x,
			box.y,
			box.w,
			box.h,
			color,
			layout.highlightAlpha,
		);
		fill.setDepth(2);
		return fill;
	}

	function drawMarkers(
		position: IPosition,
		destinations: ISquare[],
		selected: ISquare | null,
	): void {
		clearMarkers();
		const painted = new Set<string>();
		const paint = (square: ISquare, color: number): void => {
			const key = squareKey(square);
			if (painted.has(key)) {
				return;
			}
			painted.add(key);
			markers.push(paintFill(square, color));
		};
		if (selected) {
			paint(selected, palette.selectedFill);
		}
		for (const square of destinations) {
			if (selected && sameSquare(square, selected)) {
				continue;
			}
			paint(square, palette.quietFill);
		}
		if (selected) {
			for (const dest of destinations) {
				if (!isJump(selected, dest)) {
					continue;
				}
				for (const between of squaresAlong(selected, dest)) {
					const occupant = position.squares[between.row]?.[between.col];
					if (occupant) {
						paint(between, palette.captureFill);
					}
				}
			}
		}
	}

	function layoutBoard(width: number, height: number): void {
		const top = layout.statusHeight;
		const availH = Math.max(1, height - top);
		const scale =
			width < availH ? width / tableSprite.frameW : availH / tableSprite.frameH;
		const frameScreenW = tableSprite.frameW * scale;
		const frameScreenH = tableSprite.frameH * scale;
		const frameScreenX = (width - frameScreenW) / 2;
		const frameScreenY = top + (availH - frameScreenH) / 2;
		const imageX = Math.round(frameScreenX - tableSprite.frameX * scale);
		const imageY = Math.round(frameScreenY - tableSprite.frameY * scale);
		table.setPosition(imageX, imageY);
		table.setDisplaySize(
			Math.round(tableSprite.width * scale),
			Math.round(tableSprite.height * scale),
		);
		const scaleX = table.displayWidth / tableSprite.width;
		const scaleY = table.displayHeight / tableSprite.height;
		originX = imageX + tableSprite.boardX * scaleX;
		originY = imageY + tableSprite.boardY * scaleY;
		cellW = (tableSprite.boardW * scaleX) / layout.rankCount;
		cellH = (tableSprite.boardH * scaleY) / layout.rankCount;
		for (const square of squares) {
			const box = cellBox(square);
			square.rect.setPosition(box.x, box.y);
			square.rect.setDisplaySize(box.w, box.h);
		}
		for (const view of pieceViews.values()) {
			placePiece(view, pulsing === view);
		}
		drawGrid();
	}

	function sync(
		position: IPosition,
		destinations: ISquare[],
		selected: ISquare | null,
	): void {
		if (moving) {
			return;
		}
		const next = selected ? pieceViews.get(squareKey(selected)) : null;
		if (pulsing && pulsing !== next) {
			stopPulse(pulsing);
		}
		reconcile(position, selected);
		drawMarkers(position, destinations, selected);
		if (selected) {
			const view = pieceViews.get(squareKey(selected));
			if (view) {
				startPulse(view);
			}
		} else {
			stopPulse(pulsing);
		}
	}

	function press(square: ISquare): void {
		if (moving) {
			return;
		}
		const view = pieceViews.get(squareKey(square));
		if (!view) {
			return;
		}
		scene.tweens.killTweensOf(view.sprite);
		scene.tweens.add({
			targets: view.sprite,
			scaleX: view.baseScale * layout.pressScale,
			scaleY: view.baseScale * layout.pressScale,
			duration: layout.pressMs,
			ease: 'Sine.easeOut',
			yoyo: true,
		});
	}

	function deny(square: ISquare): void {
		if (moving) {
			return;
		}
		clearDeny();
		const box = cellBox(square);
		denyFill = paintFill(square, palette.denyFill);
		scene.tweens.add({
			targets: denyFill,
			alpha: 0,
			duration: 240,
			ease: 'Sine.easeOut',
			onComplete: () => {
				clearDeny();
			},
		});
		const view = pieceViews.get(squareKey(square));
		if (!view) {
			return;
		}
		scene.tweens.killTweensOf(view.sprite);
		view.sprite.setScale(view.baseScale);
		view.sprite.setPosition(box.x, box.y);
		scene.tweens.add({
			targets: view.sprite,
			x: box.x + 4,
			duration: 40,
			ease: 'Sine.easeInOut',
			yoyo: true,
			repeat: 2,
			onComplete: () => {
				view.sprite.setPosition(box.x, box.y);
				view.sprite.setScale(view.baseScale);
			},
		});
	}

	function playMove(
		move: IMove,
		onDone: () => void,
		onLand?: (took: boolean) => void,
	): void {
		if (moving) {
			return;
		}
		const view = pieceViews.get(squareKey(move.from));
		if (!view) {
			onDone();
			return;
		}
		moving = true;
		clearMarkers();
		stopPulse(view);
		stopPulse(pulsing);
		view.shadow.setAlpha(0);
		view.shadow.setVisible(false);
		view.sprite.setScale(view.baseScale);
		view.sprite.setDepth(6);
		pieceViews.delete(squareKey(move.from));
		const hops = move.path;
		let from = move.from;
		const finish = (): void => {
			const land = hops[hops.length - 1] ?? move.from;
			view.square = land;
			pieceViews.set(squareKey(land), view);
			placePiece(view, false);
			moving = false;
			onDone();
		};
		const step = (index: number): void => {
			if (index >= hops.length) {
				finish();
				return;
			}
			const land = hops[index];
			const box = cellBox(land);
			const capture = isJump(from, land);
			scene.tweens.add({
				targets: view.sprite,
				x: box.x,
				y: box.y,
				scaleX: view.baseScale,
				scaleY: view.baseScale,
				duration: layout.moveMs,
				ease: 'Sine.easeInOut',
				onComplete: () => {
					if (capture) {
						for (const between of squaresAlong(from, land)) {
							const taken = pieceViews.get(squareKey(between));
							if (taken) {
								taken.sprite.setVisible(false);
								taken.shadow.setVisible(false);
								taken.shadow.setAlpha(0);
							}
						}
					}
					onLand?.(capture);
					from = land;
					step(index + 1);
				},
			});
		};
		step(0);
	}

	return {
		sync,
		layout: layoutBoard,
		press,
		deny,
		playMove,
	};
}
