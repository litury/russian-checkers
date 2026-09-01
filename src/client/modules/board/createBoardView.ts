import Phaser from 'phaser';
import {
	fireSprites,
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
		...pitSprites.keys,
		pieceSprites.selectRim,
		pieceSprites.moveRim,
		pieceSprites.captureRim,
		...fireSprites.flameLoop,
		...fireSprites.flameUp,
		...fireSprites.flameLand,
		...fireSprites.smokeLoop,
		...fireSprites.smokeLand,
		fireSprites.ember,
	]) {
		scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
	}
	const frame = scene.add.image(0, 0, tableBgs.portrait.key);
	frame.setOrigin(0, 0);
	frame.setDepth(0);
	frame.disableInteractive();
	const selectRim = scene.add.image(0, 0, pieceSprites.selectRim);
	selectRim.setOrigin(0.5);
	selectRim.setDepth(3);
	selectRim.setAlpha(0);
	selectRim.setVisible(false);
	const smoke = scene.add.sprite(0, 0, fireSprites.smokeLoop[0]);
	smoke.setOrigin(0.5);
	smoke.setDepth(2.5);
	smoke.setVisible(false);
	const flame = scene.add.sprite(0, 0, fireSprites.flameLoop[0]);
	flame.setOrigin(0.5, 0.85);
	flame.setDepth(2.7);
	flame.setVisible(false);
	const embers = scene.add.particles(0, 0, fireSprites.ember, {
		lifespan: 420,
		speed: { min: 16, max: 40 },
		angle: { min: 250, max: 290 },
		gravityY: -30,
		scale: { start: 1.1, end: 0 },
		alpha: { start: 0.85, end: 0 },
		frequency: 90,
		quantity: 1,
		emitting: false,
	});
	embers.setDepth(2.65);
	if (!scene.anims.exists('flame-loop')) {
		scene.anims.create({
			key: 'flame-loop',
			frames: fireSprites.flameLoop.map((key) => ({ key })),
			frameRate: 10,
			repeat: -1,
		});
		scene.anims.create({
			key: 'flame-up',
			frames: fireSprites.flameUp.map((key) => ({ key })),
			frameRate: 12,
			repeat: 0,
		});
		scene.anims.create({
			key: 'flame-land',
			frames: fireSprites.flameLand.map((key) => ({ key })),
			frameRate: 12,
			repeat: 0,
		});
		scene.anims.create({
			key: 'smoke-loop',
			frames: fireSprites.smokeLoop.map((key) => ({ key })),
			frameRate: 8,
			repeat: -1,
		});
		scene.anims.create({
			key: 'smoke-land',
			frames: fireSprites.smokeLand.map((key) => ({ key })),
			frameRate: 10,
			repeat: 0,
		});
	}
	let fireGen = 0;
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

	function placeFxAt(x: number, y: number, w: number, h: number): void {
		smoke.setPosition(x, y);
		smoke.setDisplaySize(w, h);
		flame.setPosition(x, y);
		flame.setDisplaySize(w, h);
		embers.setPosition(x, y);
	}

	function hideFire(): void {
		fireGen += 1;
		flame.off('animationcomplete');
		smoke.off('animationcomplete');
		flame.anims.stop();
		smoke.anims.stop();
		scene.tweens.killTweensOf(flame);
		scene.tweens.killTweensOf(smoke);
		flame.setVisible(false);
		smoke.setVisible(false);
		smoke.setAlpha(1);
		embers.stop();
	}

	function playFireAppearLoop(): void {
		const gen = fireGen;
		flame.setVisible(true);
		smoke.setVisible(false);
		smoke.setAlpha(1);
		embers.start();
		flame.off('animationcomplete');
		flame.once('animationcomplete', (anim: Phaser.Animations.Animation) => {
			if (gen !== fireGen) {
				return;
			}
			if (anim.key === 'flame-up') {
				flame.play('flame-loop');
				smoke.setVisible(true);
				smoke.play('smoke-loop');
			}
		});
		flame.play('flame-up');
	}

	function playFireLoop(): void {
		flame.setVisible(true);
		smoke.setVisible(true);
		smoke.setAlpha(1);
		if (flame.anims.currentAnim?.key !== 'flame-loop') {
			flame.play('flame-loop');
		}
		if (smoke.anims.currentAnim?.key !== 'smoke-loop') {
			smoke.play('smoke-loop');
		}
		embers.start();
	}

	function playFireStreak(): void {
		smoke.setVisible(false);
		smoke.anims.stop();
		embers.stop();
		flame.off('animationcomplete');
		flame.anims.stop();
		flame.setVisible(true);
		flame.setTexture(fireSprites.flameUp[1]);
		flame.setOrigin(0.5, 0.85);
	}

	function playFireOut(): void {
		if (!flame.visible && !smoke.visible) {
			return;
		}
		const gen = fireGen;
		flame.off('animationcomplete');
		smoke.setVisible(true);
		smoke.setAlpha(1);
		flame.setVisible(true);
		embers.explode(6);
		smoke.play('smoke-land');
		flame.once('animationcomplete', (anim: Phaser.Animations.Animation) => {
			if (gen !== fireGen) {
				return;
			}
			if (anim.key === 'flame-land') {
				hideFire();
			}
		});
		flame.play('flame-land');
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

	function stopPulse(view: PieceView | null, keepFire = false): void {
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
			if (!keepFire) {
				playFireOut();
			}
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
		const box = cellBox(view.square);
		placeFxAt(box.x, box.y, box.w, box.h);
		if (!already) {
			playFireAppearLoop();
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
			view.sprite.setPosition(box.x, box.y - liftPx());
			view.sprite.setScale(view.baseScale);
			placeFxAt(box.x, box.y, box.w, box.h);
			playFireLoop();
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
		const bg = height > width ? tableBgs.portrait : tableBgs.landscape;
		const fieldSize = Math.min(width, height);
		if (frame.texture.key !== bg.key) {
			frame.setTexture(bg.key);
		}
		originX = height > width ? 0 : Math.round((width - fieldSize) / 2);
		originY = height > width ? Math.round((height - fieldSize) / 2) : 0;
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
			const box = cellBox(pulsing.square);
			placeFxAt(box.x, box.y, box.w, box.h);
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
		stopPulse(view, true);
		stopPulse(pulsing, true);
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
			playFireOut();
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
			const fromBox = cellBox(from);
			const capture = isJump(from, land);
			playFireStreak();
			placeFxAt(fromBox.x, fromBox.y, fromBox.w, fromBox.h);
			scene.tweens.add({
				targets: [flame],
				x: box.x,
				y: box.y,
				duration: layout.moveMs,
				ease: 'Sine.easeInOut',
			});
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
