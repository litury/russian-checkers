import Phaser from 'phaser';
import { computeFieldLayout } from '@/client/config/fieldLayout';
import {
	layout,
	pieceSprites,
	pitSprites,
	tableBgs,
} from '@/client/config/layout';
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

function mixRgb(from: number, to: number, t: number): number {
	const clamped = Math.min(1, Math.max(0, t));
	const r = Math.round(
		((from >> 16) & 255) * (1 - clamped) + ((to >> 16) & 255) * clamped,
	);
	const g = Math.round(
		((from >> 8) & 255) * (1 - clamped) + ((to >> 8) & 255) * clamped,
	);
	const b = Math.round((from & 255) * (1 - clamped) + (to & 255) * clamped);
	return (r << 16) | (g << 8) | b;
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
	for (const key of [
		tableBgs.portrait.key,
		tableBgs.landscape.key,
		'earthFill',
		...pitSprites.keys,
		pieceSprites.selectRim,
		pieceSprites.moveRim,
		pieceSprites.captureRim,
	]) {
		scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
	}
	const earth = scene.add.tileSprite(0, 0, 8, 8, 'earthFill');
	earth.setOrigin(0, 0);
	earth.setDepth(-1);
	earth.setScrollFactor(0);
	const bottomPad = scene.add.tileSprite(0, 0, 8, 8, 'earthFill');
	bottomPad.setOrigin(0, 0);
	bottomPad.setDepth(1);
	bottomPad.setScrollFactor(0);
	const frame = scene.add.image(0, 0, tableBgs.portrait.key);
	frame.setOrigin(0, 0);
	frame.setDepth(0);
	frame.disableInteractive();
	const selectRim = scene.add.image(0, 0, pieceSprites.selectRim);
	selectRim.setOrigin(0.5);
	selectRim.setDepth(3);
	selectRim.setAlpha(0);
	selectRim.setVisible(false);
	const squares: {
		row: number;
		col: number;
		rect: Phaser.GameObjects.Rectangle;
	}[] = [];
	const markers: Phaser.GameObjects.Image[] = [];
	const pieceViews = new Map<string, PieceView>();
	const grid = scene.add.graphics();
	grid.setDepth(1);
	let originX = 0;
	let originY = 0;
	let cellW = 0;
	let cellH = 0;
	let moving = false;
	let pulsing: PieceView | null = null;
	let pressView: PieceView | null = null;
	let pressTween: Phaser.Tweens.Tween | null = null;
	let denyTween: Phaser.Tweens.Tween | null = null;

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

	const pits: { square: ISquare; sprite: Phaser.GameObjects.Image }[] = [];
	let pitCycle = 0;
	for (let visRow = 0; visRow < layout.rankCount; visRow += 1) {
		for (let col = 0; col < layout.rankCount; col += 1) {
			if ((visRow + col) % 2 !== 1) {
				continue;
			}
			const row = layout.rankCount - 1 - visRow;
			const key = pitSprites.keys[pitCycle % pitSprites.keys.length];
			pitCycle += 1;
			const sprite = scene.add.image(0, 0, key);
			sprite.setOrigin(0.5);
			sprite.setDepth(1);
			pits.push({ square: { row, col }, sprite });
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

	function liftPx(): number {
		return Math.round(Math.min(cellW, cellH) * layout.liftRatio);
	}

	function pressDip(): number {
		return Math.round(Math.min(cellW, cellH) * layout.pressDipRatio);
	}

	function clearMarkers(): void {
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

	function hideSelectRim(): void {
		scene.tweens.killTweensOf(selectRim);
		selectRim.setAlpha(0);
		selectRim.setVisible(false);
	}

	function placeSelectRim(view: PieceView): void {
		const box = cellBox(view.square);
		selectRim.setPosition(box.x, box.y);
		selectRim.setDisplaySize(box.w, box.h);
		selectRim.setDepth(3);
		selectRim.setVisible(true);
	}

	function breatheSelectRim(): void {
		scene.tweens.killTweensOf(selectRim);
		selectRim.setAlpha(0);
		scene.tweens.add({
			targets: selectRim,
			alpha: layout.markerBreathMax,
			duration: layout.markerFadeMs,
			ease: 'Sine.easeOut',
			onComplete: () => {
				scene.tweens.add({
					targets: selectRim,
					alpha: layout.markerBreathMin,
					duration: layout.markerBreathMs,
					ease: 'Sine.easeInOut',
					yoyo: true,
					repeat: -1,
				});
			},
		});
	}

	function clearDeny(view?: PieceView): void {
		if (denyTween) {
			denyTween.stop();
			denyTween = null;
		}
		if (view) {
			view.sprite.clearTint();
		}
	}

	function stopPulse(view: PieceView | null): void {
		if (!view) {
			return;
		}
		if (pressView === view) {
			pressTween?.stop();
			pressTween = null;
			pressView = null;
		}
		scene.tweens.killTweensOf(view.sprite);
		scene.tweens.killTweensOf(view.shadow);
		const box = cellBox(view.square);
		view.sprite.setScale(view.baseScale);
		view.sprite.setPosition(box.x, box.y);
		view.sprite.setDepth(4);
		view.shadow.setVisible(false);
		view.shadow.setAlpha(0);
		if (pulsing === view) {
			pulsing = null;
			hideSelectRim();
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
		const busy = pressView === view || pulsing === view;
		if (!busy) {
			view.sprite.setPosition(box.x, box.y);
			view.sprite.setScale(view.baseScale);
		} else if (pulsing === view && pressView !== view) {
			view.sprite.setPosition(box.x, box.y - liftPx());
			view.sprite.setScale(view.baseScale);
		}
		view.sprite.setDepth(selected ? 5 : 4);
		placeShadow(view, selected);
	}

	function destroyView(view: PieceView): void {
		clearDeny(view);
		stopPulse(view);
		view.sprite.destroy();
		view.shadow.destroy();
	}

	function liftPiece(view: PieceView): void {
		if (pulsing !== view || moving) {
			return;
		}
		const box = cellBox(view.square);
		scene.tweens.add({
			targets: view.sprite,
			y: box.y - liftPx(),
			scaleX: view.baseScale,
			scaleY: view.baseScale,
			duration: layout.selectMs,
			ease: 'Sine.easeOut',
		});
	}

	function runPress(view: PieceView, onIdle?: () => void): void {
		const box = cellBox(view.square);
		if (pressView && pressView !== view) {
			pressTween?.stop();
		}
		scene.tweens.killTweensOf(view.sprite);
		clearDeny(view);
		view.sprite.clearTint();
		view.sprite.setScale(view.baseScale);
		view.sprite.setPosition(box.x, box.y);
		pressView = view;
		pressTween = scene.tweens.add({
			targets: view.sprite,
			scaleY: view.baseScale * layout.pressScaleY,
			y: box.y + pressDip(),
			duration: layout.pressMs,
			ease: 'Sine.easeInOut',
			yoyo: true,
			onComplete: () => {
				view.sprite.setScale(view.baseScale);
				view.sprite.setPosition(box.x, box.y);
				pressTween = null;
				if (pressView === view) {
					pressView = null;
				}
				onIdle?.();
			},
		});
	}

	function startPulse(view: PieceView): void {
		const already = pulsing === view;
		if (pulsing && pulsing !== view) {
			stopPulse(pulsing);
		}
		pulsing = view;
		view.sprite.setDepth(5);
		placeSelectRim(view);
		if (!already) {
			breatheSelectRim();
			view.shadow.setVisible(true);
			view.shadow.setAlpha(0);
			scene.tweens.killTweensOf(view.shadow);
			scene.tweens.add({
				targets: view.shadow,
				alpha: layout.shadowAlpha,
				duration: layout.selectMs,
				ease: 'Sine.easeOut',
			});
		} else {
			placeShadow(view, true);
		}
		if (already && pressView !== view) {
			const box = cellBox(view.square);
			view.sprite.setPosition(box.x, box.y - liftPx());
			view.sprite.setScale(view.baseScale);
			return;
		}
		if (pressView === view && pressTween) {
			pressTween.once('complete', () => {
				liftPiece(view);
			});
			return;
		}
		runPress(view, () => {
			liftPiece(view);
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

	function breatheMarker(ring: Phaser.GameObjects.Image): void {
		scene.tweens.add({
			targets: ring,
			alpha: layout.markerBreathMax,
			duration: layout.markerFadeMs,
			ease: 'Sine.easeOut',
			onComplete: () => {
				scene.tweens.add({
					targets: ring,
					alpha: layout.markerBreathMin,
					duration: layout.markerBreathMs,
					ease: 'Sine.easeInOut',
					yoyo: true,
					repeat: -1,
				});
			},
		});
	}

	function addMoveRim(square: ISquare, texture: string): void {
		const box = cellBox(square);
		const rim = scene.add.image(box.x, box.y, texture);
		rim.setOrigin(0.5);
		rim.setDisplaySize(box.w, box.h);
		rim.setDepth(3);
		rim.setAlpha(0);
		breatheMarker(rim);
		markers.push(rim);
	}

	function drawMarkers(
		position: IPosition,
		destinations: ISquare[],
		selected: ISquare | null,
	): void {
		clearMarkers();
		const painted = new Set<string>();
		const paint = (square: ISquare, texture: string): void => {
			const key = squareKey(square);
			if (painted.has(key)) {
				return;
			}
			painted.add(key);
			addMoveRim(square, texture);
		};
		for (const square of destinations) {
			if (selected && sameSquare(square, selected)) {
				continue;
			}
			paint(square, pieceSprites.moveRim);
		}
		if (!selected) {
			return;
		}
		for (const dest of destinations) {
			if (!isJump(selected, dest)) {
				continue;
			}
			for (const between of squaresAlong(selected, dest)) {
				const occupant = position.squares[between.row]?.[between.col];
				if (occupant) {
					paint(between, pieceSprites.captureRim);
				}
			}
		}
	}

	function layoutBoard(width: number, height: number): void {
		earth.setPosition(0, 0);
		earth.setSize(width, height);
		const field = computeFieldLayout(width, height);
		if (field.portrait) {
			bottomPad.setVisible(true);
			bottomPad.setPosition(0, height - layout.boardBottomGap);
			bottomPad.setSize(width, layout.boardBottomGap);
		} else {
			bottomPad.setVisible(false);
		}
		const bg = field.portrait ? tableBgs.portrait : tableBgs.landscape;
		const fieldSize = field.fieldSize;
		if (frame.texture.key !== bg.key) {
			frame.setTexture(bg.key);
		}
		originX = field.originX;
		originY = field.originY;
		const scale = fieldSize / bg.fieldW;
		frame.setScale(scale);
		frame.setPosition(
			Math.round(originX - bg.fieldX * scale),
			Math.round(originY - bg.fieldY * scale),
		);
		cellW = fieldSize / layout.rankCount;
		cellH = fieldSize / layout.rankCount;
		for (const pit of pits) {
			const box = cellBox(pit.square);
			pit.sprite.setPosition(box.x, box.y);
			pit.sprite.setDisplaySize(box.w, box.h);
		}
		for (const square of squares) {
			const box = cellBox(square);
			square.rect.setPosition(box.x, box.y);
			square.rect.setDisplaySize(box.w, box.h);
		}
		for (const view of pieceViews.values()) {
			placePiece(view, pulsing === view);
		}
		if (pulsing) {
			placeSelectRim(pulsing);
		} else {
			hideSelectRim();
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
		runPress(view);
	}

	function deny(square: ISquare): void {
		if (moving) {
			return;
		}
		const view = pieceViews.get(squareKey(square));
		if (!view) {
			return;
		}
		const box = cellBox(square);
		if (pressView === view) {
			pressTween?.stop();
			pressTween = null;
			pressView = null;
		}
		scene.tweens.killTweensOf(view.sprite);
		clearDeny(view);
		view.sprite.setScale(view.baseScale);
		view.sprite.setPosition(box.x, box.y);
		view.sprite.setTint(palette.denyFill);
		scene.tweens.add({
			targets: view.sprite,
			x: box.x + 5,
			duration: 45,
			ease: 'Sine.easeInOut',
			yoyo: true,
			repeat: 2,
			onComplete: () => {
				view.sprite.setPosition(box.x, box.y);
				view.sprite.setScale(view.baseScale);
			},
		});
		const fade = { t: 0 };
		denyTween = scene.tweens.add({
			targets: fade,
			t: 1,
			delay: 60,
			duration: 240,
			ease: 'Sine.easeOut',
			onUpdate: () => {
				view.sprite.setTint(mixRgb(palette.denyFill, 0xffffff, fade.t));
			},
			onComplete: () => {
				view.sprite.clearTint();
				denyTween = null;
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
		hideSelectRim();
		clearDeny(view);
		view.shadow.setAlpha(0);
		view.shadow.setVisible(false);
		view.sprite.clearTint();
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
