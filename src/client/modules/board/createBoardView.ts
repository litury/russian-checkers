import Phaser from 'phaser';
import { computeFieldLayout } from '@/client/config/fieldLayout';
import {
	captureSprites,
	debrisSprites,
	fireRing,
	fireSprites,
	layout,
	pieceSprites,
	pitSprites,
	tableLayers,
	wreathSprites,
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

function cellHash(row: number, col: number): number {
	return ((row * 73856093) ^ (col * 19349663) ^ 83492791) >>> 0;
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
	outline: Phaser.GameObjects.Image;
	shadow: Phaser.GameObjects.Ellipse;
	baseScale: number;
};

const lidStroke = 0x141210;

export function createBoardView(
	scene: Phaser.Scene,
	onSquare: (square: ISquare) => void,
): IBoardView {
	scene.input.topOnly = false;
	for (const key of [
		tableLayers.earth,
		...pitSprites.keys,
		debrisSprites.stonePl,
		debrisSprites.stoneGm,
		wreathSprites.mask,
		...fireSprites.idle,
		...fireSprites.up,
		...fireSprites.land,
		...fireSprites.puffs,
		fireSprites.ember,
		captureSprites.igniteLight,
		captureSprites.igniteDark,
		captureSprites.igniteKingLight,
		captureSprites.igniteKingDark,
		...captureSprites.swellLight,
		...captureSprites.swellDark,
		...captureSprites.swellKingLight,
		...captureSprites.swellKingDark,
		...captureSprites.burstLight,
		...captureSprites.burstDark,
		...captureSprites.burstKingLight,
		...captureSprites.burstKingDark,
		...captureSprites.smolderLight,
		...captureSprites.smolderDark,
		...captureSprites.smolderKingLight,
		...captureSprites.smolderKingDark,
		...captureSprites.flash,
		captureSprites.scorch,
	]) {
		scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
	}
	const ground = scene.add.tileSprite(0, 0, 64, 64, tableLayers.earth);
	ground.setOrigin(0, 0);
	ground.setDepth(0);
	ground.disableInteractive();
	const selectRim = scene.add.image(0, 0, wreathSprites.mask);
	selectRim.setOrigin(0.5);
	selectRim.setDepth(3);
	selectRim.setAlpha(0);
	selectRim.setVisible(false);
	selectRim.disableInteractive();
	type FirePose = 'idle' | 'up' | 'land';
	type Tongue = {
		sprite: Phaser.GameObjects.Image;
		kind: 0 | 1 | 2;
		angle: number;
	};
	const tongues: Tongue[] = fireRing.types.map((kind, index) => {
		const sprite = scene.add.image(0, 0, fireSprites.idle[kind]);
		sprite.setOrigin(0.5, 1);
		sprite.setDepth(2.7);
		sprite.setVisible(false);
		sprite.disableInteractive();
		return {
			sprite,
			kind: kind as Tongue['kind'],
			angle: (fireRing.anglesDeg[index] * Math.PI) / 180,
		};
	});
	const rim = new Phaser.Geom.Circle(0, 0, 16);
	const puffWeakFreqs = [100, 130, 160];
	const puffs = fireSprites.puffs.map((key, index) => {
		const puff = scene.add.particles(0, 0, key, {
			lifespan: 650,
			speedY: { min: -36, max: -14 },
			speedX: { min: -8, max: 8 },
			gravityY: -12,
			scale: { start: 1, end: 1.35 },
			alpha: { start: 0.55, end: 0 },
			frequency: puffWeakFreqs[index],
			quantity: 1,
			emitting: false,
			rotate: { min: -20, max: 20 },
			emitZone: { type: 'edge', source: rim, quantity: 16 },
		});
		puff.setDepth(6);
		return puff;
	});
	const embers = scene.add.particles(0, 0, fireSprites.ember, {
		lifespan: 420,
		speed: { min: 16, max: 40 },
		angle: { min: 250, max: 290 },
		gravityY: -30,
		scale: { start: 1.1, end: 0 },
		alpha: { start: 0.85, end: 0 },
		frequency: 140,
		quantity: 1,
		emitting: false,
	});
	embers.setDepth(5.8);
	let fireGen = 0;
	let firePose: FirePose = 'idle';
	let fireOn = false;
	let hopBack: number | null = null;
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
	const scorches: { square: ISquare; sprite: Phaser.GameObjects.Image }[] = [];
	type CaptureVfx = {
		square: ISquare;
		sprite: Phaser.GameObjects.Image;
		timer?: Phaser.Time.TimerEvent;
		kind: 'swell' | 'flash';
	};
	const captureVfx: CaptureVfx[] = [];
	const pendingLand = new Set<string>();

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
	const debris: {
		square: ISquare;
		sprite: Phaser.GameObjects.Image;
		fitW: number;
		fitH: number;
	}[] = [];
	const placedPits = new Map<string, string>();
	const pitNeighbor = [
		[-1, -1],
		[-1, 1],
		[0, -2],
		[-2, 0],
	];
	for (let visRow = 0; visRow < layout.rankCount; visRow += 1) {
		for (let col = 0; col < layout.rankCount; col += 1) {
			const row = layout.rankCount - 1 - visRow;
			const dark = (visRow + col) % 2 === 1;
			if (!dark) {
				continue;
			}
			const forbidden = new Set<string>();
			for (const [dr, dc] of pitNeighbor) {
				const seen = placedPits.get(`${visRow + dr},${col + dc}`);
				if (seen) {
					forbidden.add(seen);
				}
			}
			const pool = pitSprites.keys.filter((key) => !forbidden.has(key));
			const choices = pool.length > 0 ? pool : pitSprites.keys;
			const key = choices[cellHash(visRow, col) % choices.length];
			placedPits.set(`${visRow},${col}`, key);
			const sprite = scene.add.image(0, 0, key);
			sprite.setOrigin(0.5);
			sprite.setDepth(1);
			sprite.disableInteractive();
			pits.push({ square: { row, col }, sprite });
		}
	}
	for (const stone of debrisSprites.center) {
		const row = layout.rankCount - 1 - stone.visRow;
		const sprite = scene.add.image(0, 0, stone.key);
		sprite.setOrigin(0.5);
		sprite.setDepth(1);
		sprite.disableInteractive();
		debris.push({
			square: { row, col: stone.col },
			sprite,
			fitW: stone.texW / 64,
			fitH: stone.texH / 64,
		});
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
		return 6;
	}

	function worldXY(sprite: Phaser.GameObjects.Image): { x: number; y: number } {
		const parent = sprite.parentContainer;
		if (parent) {
			return { x: parent.x + sprite.x, y: parent.y + sprite.y };
		}
		return { x: sprite.x, y: sprite.y };
	}

	function syncOutline(view: PieceView): void {
		const sprite = view.sprite;
		const outline = view.outline;
		const pos = worldXY(sprite);
		if (outline.texture.key !== sprite.texture.key) {
			outline.setTexture(sprite.texture.key);
		}
		outline.setOrigin(sprite.originX, sprite.originY);
		outline.setPosition(pos.x, pos.y);
		outline.setDisplaySize(sprite.displayWidth + 2, sprite.displayHeight + 2);
		outline.setDepth(sprite.depth - 0.05);
		outline.setVisible(sprite.visible);
		outline.setAlpha(sprite.alpha);
		outline.setTint(
			sprite.isTinted && sprite.tintTopLeft === 0xffe0a8 ? 0xffe0a8 : lidStroke,
		);
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

	function puffsStartWeak(): void {
		puffs.forEach((puff, index) => {
			puff.setFrequency(puffWeakFreqs[index], 1);
			puff.start();
		});
	}

	function puffsQuieter(): void {
		puffs.forEach((puff, index) => {
			puff.setFrequency(200 + index * 30, 1);
			puff.start();
		});
	}

	function puffsStop(): void {
		for (const puff of puffs) {
			puff.stop();
		}
	}

	function puffsBurst(): void {
		for (const puff of puffs) {
			puff.explode(4);
		}
	}

	function wrapAngle(angle: number): number {
		return Math.atan2(Math.sin(angle), Math.cos(angle));
	}

	function tongueSize(pose: FirePose, cell: number): { w: number; h: number } {
		const unit = cell / 64;
		const spec =
			pose === 'up'
				? fireRing.up
				: pose === 'land'
					? fireRing.land
					: fireRing.idle;
		return { w: spec.w * unit, h: spec.h * unit };
	}

	function wellRadius(pieceSize: number, trailing: boolean): number {
		const half = pieceSize / 2;
		if (trailing) {
			return half * fireRing.hopRadius;
		}
		return half * fireRing.wellRatio;
	}

	function layoutTongues(
		cx: number,
		cy: number,
		pieceSize: number,
		pose: FirePose,
		backRot: number | null,
	): void {
		firePose = pose;
		const cell = pieceSize / layout.pieceFit;
		const half = pieceSize / 2;
		const trailing = backRot !== null;
		const radius = wellRadius(pieceSize, trailing);
		const ox = trailing ? Math.sin(backRot) * half * fireRing.hopTrail : 0;
		const oy = trailing ? -Math.cos(backRot) * half * fireRing.hopTrail : 0;
		const size = tongueSize(pose, cell);
		const keys = fireSprites[pose];
		for (const tongue of tongues) {
			const rot = trailing ? backRot + wrapAngle(tongue.angle) * 0.12 : 0;
			tongue.sprite.setTexture(keys[tongue.kind]);
			tongue.sprite.setOrigin(0.5, trailing ? 1 : 0.75);
			tongue.sprite.setRotation(rot);
			tongue.sprite.setPosition(
				cx + ox + Math.sin(tongue.angle) * radius,
				cy + oy - Math.cos(tongue.angle) * radius,
			);
			tongue.sprite.setDisplaySize(size.w, size.h);
		}
	}

	function stopTongueWobble(): void {
		for (const tongue of tongues) {
			scene.tweens.killTweensOf(tongue.sprite);
			tongue.sprite.setAlpha(fireOn ? 1 : 0);
		}
	}

	function startTongueWobble(): void {
		stopTongueWobble();
		tongues.forEach((tongue, index) => {
			const baseX = tongue.sprite.scaleX;
			const baseY = tongue.sprite.scaleY;
			tongue.sprite.setAlpha(0.78);
			scene.tweens.add({
				targets: tongue.sprite,
				alpha: { from: 0.72, to: 1 },
				scaleX: { from: baseX * 0.92, to: baseX * 1.06 },
				scaleY: { from: baseY * 0.92, to: baseY * 1.06 },
				duration: 260 + index * 70,
				delay: index * 45,
				yoyo: true,
				repeat: -1,
				ease: 'Sine.easeInOut',
			});
		});
	}

	function showTongues(): void {
		fireOn = true;
		for (const tongue of tongues) {
			tongue.sprite.setVisible(true);
			tongue.sprite.setAlpha(1);
			tongue.sprite.setDepth(2.7);
		}
	}

	function placeFxAt(x: number, y: number, w: number, h: number): void {
		const pieceSize = Math.min(w, h) * layout.pieceFit;
		layoutTongues(x, y, pieceSize, firePose, hopBack);
		rim.setTo(0, 0, pieceSize * 0.5);
		for (const puff of puffs) {
			puff.setPosition(x, y);
			for (const zone of puff.emitZones) {
				(zone as Phaser.GameObjects.Particles.Zones.EdgeZone).updateSource();
			}
		}
		embers.setPosition(x, y);
	}

	function hideFire(): void {
		fireGen += 1;
		hopBack = null;
		firePose = 'idle';
		stopTongueWobble();
		scene.tweens.killTweensOf(embers);
		for (const puff of puffs) {
			scene.tweens.killTweensOf(puff);
		}
		fireOn = false;
		for (const tongue of tongues) {
			tongue.sprite.setVisible(false);
			tongue.sprite.setAlpha(0);
		}
		puffsStop();
		embers.stop();
	}

	function ringCenter(): { x: number; y: number; pieceSize: number } {
		const pieceSize = Math.min(cellW, cellH) * layout.pieceFit;
		const t0 = tongues[0];
		if (!t0) {
			return { x: 0, y: 0, pieceSize };
		}
		const radius = wellRadius(pieceSize, hopBack !== null);
		return {
			x: t0.sprite.x - Math.sin(t0.angle) * radius,
			y: t0.sprite.y + Math.cos(t0.angle) * radius,
			pieceSize,
		};
	}

	function playFireLoop(): void {
		fireGen += 1;
		hopBack = null;
		showTongues();
		if (!tongues[0]?.sprite.parentContainer) {
			const at = ringCenter();
			layoutTongues(at.x, at.y, at.pieceSize, 'idle', null);
		}
		startTongueWobble();
		puffsStartWeak();
		embers.setFrequency(140, 1);
		embers.start();
	}

	function stickFlame(view: PieceView): void {
		if (tongues[0]?.sprite.parentContainer) {
			return;
		}
		const pos = worldXY(view.sprite);
		layoutTongues(pos.x, pos.y, view.sprite.displayWidth, firePose, hopBack);
	}

	function followEmitters(view: PieceView): void {
		const pos = worldXY(view.sprite);
		embers.setPosition(pos.x, pos.y);
		for (const puff of puffs) {
			puff.setPosition(pos.x, pos.y);
		}
	}

	function flashGhost(view: PieceView): void {
		const ghost = scene.add.image(
			view.sprite.x,
			view.sprite.y,
			view.sprite.texture.key,
		);
		ghost.setOrigin(view.sprite.originX, view.sprite.originY);
		ghost.setDisplaySize(view.sprite.displayWidth, view.sprite.displayHeight);
		ghost.setAlpha(0.3);
		ghost.setDepth(5);
		scene.tweens.add({
			targets: ghost,
			alpha: 0,
			duration: layout.afterimageMs,
			onComplete: () => {
				ghost.destroy();
			},
		});
	}

	function playFireTakeoff(): void {
		showTongues();
		stopTongueWobble();
		const at = ringCenter();
		layoutTongues(at.x, at.y, at.pieceSize, 'up', hopBack);
		puffsQuieter();
		embers.setFrequency(90, 1);
		embers.start();
	}

	function playFireStreak(): void {
		showTongues();
		stopTongueWobble();
		puffsQuieter();
		embers.setFrequency(90, 1);
		embers.start();
		const at = ringCenter();
		layoutTongues(at.x, at.y, at.pieceSize, 'up', hopBack);
	}

	function playFireOut(): void {
		if (!fireOn) {
			return;
		}
		const gen = fireGen;
		stopTongueWobble();
		showTongues();
		hopBack = null;
		const at = ringCenter();
		layoutTongues(at.x, at.y, at.pieceSize, 'land', null);
		puffsBurst();
		embers.explode(6);
		scene.time.delayedCall(layout.landHoldMs, () => {
			if (gen !== fireGen) {
				return;
			}
			hideFire();
		});
	}

	function hideSelectRim(): void {
		scene.tweens.killTweensOf(selectRim);
		selectRim.setAlpha(0);
		selectRim.setVisible(false);
		selectRim.setAngle(0);
	}

	function placeSelectRim(view: PieceView): void {
		const box = cellBox(view.square);
		scene.tweens.killTweensOf(selectRim);
		selectRim.setTexture(wreathSprites.mask);
		selectRim.setTint(palette.selectedFill);
		selectRim.setPosition(box.x, box.y);
		selectRim.setDisplaySize(box.w, box.h);
		selectRim.setDepth(3);
		selectRim.setAngle(0);
		selectRim.setVisible(true);
		selectRim.setAlpha(0);
		scene.tweens.add({
			targets: selectRim,
			alpha: layout.markerBreathMax,
			duration: layout.markerFadeMs,
			ease: 'Sine.easeOut',
		});
		scene.tweens.add({
			targets: selectRim,
			angle: 360,
			duration: wreathSprites.spinMs,
			repeat: -1,
			ease: 'Linear',
		});
	}

	function breatheSelectRim(): void {
		return;
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
		syncOutline(view);
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
		view.baseScale = (size * layout.pieceFit) / pieceSprites.size;
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
		syncOutline(view);
	}

	function destroyView(view: PieceView): void {
		clearDeny(view);
		stopPulse(view);
		view.sprite.destroy();
		view.outline.destroy();
		view.shadow.destroy();
	}

	function scorchSize(box: { w: number; h: number }): number {
		return Math.min(box.w, box.h) * layout.pitFit * layout.scorchPitScale;
	}

	function placeScorch(
		sprite: Phaser.GameObjects.Image,
		square: ISquare,
	): void {
		const box = cellBox(square);
		const size = scorchSize(box);
		sprite.setPosition(box.x, box.y);
		sprite.setDisplaySize(size, size);
	}

	function hasScorch(square: ISquare): boolean {
		return scorches.some(
			(stamp) => squareKey(stamp.square) === squareKey(square),
		);
	}

	function spawnScorch(square: ISquare): void {
		if (hasScorch(square)) {
			return;
		}
		const box = cellBox(square);
		const size = scorchSize(box);
		const scorch = scene.add.image(box.x, box.y, captureSprites.scorch);
		scorch.setOrigin(0.5);
		scorch.setDisplaySize(size, size);
		scorch.setDepth(1.2);
		scorch.setAlpha(0);
		scorch.disableInteractive();
		scorches.push({ square, sprite: scorch });
		scene.tweens.add({
			targets: scorch,
			alpha: 1,
			duration: layout.scorchFadeInMs,
			ease: 'Sine.easeOut',
		});
	}

	function clearScorches(): void {
		for (const stamp of scorches) {
			stamp.sprite.destroy();
		}
		scorches.length = 0;
	}

	function capturePieceFit(square: ISquare): {
		x: number;
		y: number;
		size: number;
	} {
		const box = cellBox(square);
		return {
			x: box.x,
			y: box.y,
			size: Math.min(box.w, box.h) * layout.pieceFit,
		};
	}

	function placeCaptureSprite(
		sprite: Phaser.GameObjects.Image,
		square: ISquare,
	): void {
		const at = capturePieceFit(square);
		sprite.setPosition(at.x, at.y);
		sprite.setDisplaySize(at.size, at.size);
	}

	function isLightKey(key: string): boolean {
		return key === pieceSprites.manLight || key === pieceSprites.kingLight;
	}

	function isKingKey(key: string): boolean {
		return key === pieceSprites.kingLight || key === pieceSprites.kingDark;
	}

	function suitKeys(
		key: string,
		manLight: readonly string[],
		manDark: readonly string[],
		kingLight: readonly string[],
		kingDark: readonly string[],
	): readonly string[] {
		const light = isLightKey(key);
		if (isKingKey(key)) {
			return light ? kingLight : kingDark;
		}
		return light ? manLight : manDark;
	}

	function igniteKeyFor(key: string): string {
		const light = isLightKey(key);
		if (isKingKey(key)) {
			return light
				? captureSprites.igniteKingLight
				: captureSprites.igniteKingDark;
		}
		return light ? captureSprites.igniteLight : captureSprites.igniteDark;
	}

	function swellKeysFor(key: string): readonly string[] {
		return suitKeys(
			key,
			captureSprites.swellLight,
			captureSprites.swellDark,
			captureSprites.swellKingLight,
			captureSprites.swellKingDark,
		);
	}

	function burstKeysFor(key: string): readonly string[] {
		return suitKeys(
			key,
			captureSprites.burstLight,
			captureSprites.burstDark,
			captureSprites.burstKingLight,
			captureSprites.burstKingDark,
		);
	}

	function smolderKeysFor(key: string): readonly string[] {
		return suitKeys(
			key,
			captureSprites.smolderLight,
			captureSprites.smolderDark,
			captureSprites.smolderKingLight,
			captureSprites.smolderKingDark,
		);
	}

	function killCaptureVfx(square?: ISquare): void {
		const keep: CaptureVfx[] = [];
		for (const fx of captureVfx) {
			if (square && squareKey(fx.square) !== squareKey(square)) {
				keep.push(fx);
				continue;
			}
			if (square && fx.kind === 'flash') {
				keep.push(fx);
				continue;
			}
			fx.timer?.remove(false);
			fx.sprite.destroy();
		}
		captureVfx.length = 0;
		captureVfx.push(...keep);
	}

	function addCaptureSprite(
		square: ISquare,
		key: string,
		depth: number,
		kind: CaptureVfx['kind'],
	): CaptureVfx {
		const at = capturePieceFit(square);
		const sprite = scene.add.image(at.x, at.y, key);
		sprite.setOrigin(0.5);
		sprite.setDisplaySize(at.size, at.size);
		sprite.setDepth(depth);
		sprite.disableInteractive();
		const fx: CaptureVfx = { square, sprite, kind };
		captureVfx.push(fx);
		return fx;
	}

	function playCaptureFrames(
		fx: CaptureVfx,
		keys: readonly string[],
		onDone: () => void,
		frameMs: number = layout.captureBurstMs,
	): void {
		let frame = 0;
		fx.sprite.setTexture(keys[0]);
		fx.timer = scene.time.addEvent({
			delay: frameMs,
			loop: true,
			callback: () => {
				frame += 1;
				if (frame >= keys.length) {
					fx.timer?.remove(false);
					fx.timer = undefined;
					onDone();
					return;
				}
				fx.sprite.setTexture(keys[frame]);
			},
		});
	}

	function playFlash(square: ISquare): void {
		if (
			captureVfx.some(
				(fx) =>
					fx.kind === 'flash' && squareKey(fx.square) === squareKey(square),
			)
		) {
			return;
		}
		const fx = addCaptureSprite(square, captureSprites.flash[0], 4.6, 'flash');
		playCaptureFrames(fx, captureSprites.flash, () => {
			fx.timer?.remove(false);
			fx.sprite.destroy();
			const index = captureVfx.indexOf(fx);
			if (index >= 0) {
				captureVfx.splice(index, 1);
			}
		});
	}

	function hideCaptureDebris(square: ISquare): void {
		pendingLand.delete(squareKey(square));
		killCaptureVfx(square);
	}

	function finishCapture(view: PieceView): void {
		pieceViews.delete(squareKey(view.square));
		if (pulsing === view) {
			pulsing = null;
		}
		scene.tweens.killTweensOf(view.sprite);
		view.shadow.setVisible(false);
		view.shadow.setAlpha(0);
		view.sprite.setVisible(false);
		view.outline.setVisible(false);
		const sqKey = squareKey(view.square);
		const chain = captureVfx.find(
			(fx) => fx.kind === 'swell' && squareKey(fx.square) === sqKey,
		);
		destroyView(view);
		if (chain?.timer) {
			pendingLand.add(sqKey);
			return;
		}
		spawnScorch(view.square);
		hideCaptureDebris(view.square);
	}

	function igniteCapture(view: PieceView): void {
		if (
			captureVfx.some(
				(fx) =>
					fx.kind === 'swell' &&
					squareKey(fx.square) === squareKey(view.square),
			)
		) {
			return;
		}
		scene.tweens.killTweensOf(view.sprite);
		view.sprite.setVisible(false);
		view.outline.setVisible(false);
		view.shadow.setVisible(false);
		view.shadow.setAlpha(0);
		const key = view.sprite.texture.key;
		const igniteKey = igniteKeyFor(key);
		const swell = swellKeysFor(key);
		const burst = burstKeysFor(key);
		const smolder = smolderKeysFor(key);
		const fx = addCaptureSprite(view.square, igniteKey, 3.7, 'swell');
		fx.timer = scene.time.delayedCall(layout.captureBurstMs, () => {
			playCaptureFrames(fx, swell, () => {
				playCaptureFrames(
					fx,
					burst,
					() => {
						playCaptureFrames(fx, smolder, () => {
							if (pendingLand.has(squareKey(view.square))) {
								hideCaptureDebris(view.square);
							}
						});
					},
					layout.hitStopMs,
				);
				playFlash(view.square);
				spawnScorch(view.square);
			});
		});
	}

	function captureBetween(from: ISquare, land: ISquare): void {
		for (const between of squaresAlong(from, land)) {
			const taken = pieceViews.get(squareKey(between));
			if (taken) {
				finishCapture(taken);
			}
		}
	}

	function igniteBetween(from: ISquare, land: ISquare): void {
		for (const between of squaresAlong(from, land)) {
			const taken = pieceViews.get(squareKey(between));
			if (taken) {
				igniteCapture(taken);
			}
		}
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
			onUpdate: () => {
				stickFlame(view);
				followEmitters(view);
				syncOutline(view);
			},
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
			onUpdate: () => {
				syncOutline(view);
			},
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
			stopPulse(pulsing, true);
		}
		pulsing = view;
		view.sprite.setDepth(5);
		placeSelectRim(view);
		const box = cellBox(view.square);
		placeFxAt(box.x, box.y, box.w, box.h);
		if (!already) {
			playFireLoop();
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
			syncOutline(view);
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
					const outline = scene.add.image(0, 0, texture);
					outline.setTint(lidStroke);
					outline.setDepth(3.95);
					outline.disableInteractive();
					const sprite = scene.add.image(0, 0, texture);
					sprite.setDepth(4);
					const shadow = scene.add.ellipse(0, 0, 8, 8, 0x000000, 1);
					shadow.setDepth(3);
					shadow.setAlpha(0);
					shadow.setVisible(false);
					view = { square, sprite, outline, shadow, baseScale: 1 };
					pieceViews.set(key, view);
				} else {
					view.square = square;
					if (view.sprite.texture.key !== texture) {
						view.sprite.setTexture(texture);
						view.outline.setTexture(texture);
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

	function addWreath(square: ISquare, tint: number, scale: number): void {
		const box = cellBox(square);
		const wreath = scene.add.image(box.x, box.y, wreathSprites.mask);
		wreath.setOrigin(0.5);
		wreath.setDisplaySize(box.w * scale, box.h * scale);
		wreath.setTint(tint);
		wreath.setDepth(3);
		wreath.setAlpha(layout.markerBreathMax);
		wreath.disableInteractive();
		markers.push(wreath);
	}

	function drawMarkers(
		position: IPosition,
		destinations: ISquare[],
		selected: ISquare | null,
	): void {
		clearMarkers();
		const painted = new Set<string>();
		const paint = (square: ISquare, tint: number, scale: number): void => {
			const key = squareKey(square);
			if (painted.has(key)) {
				return;
			}
			if (selected && sameSquare(square, selected)) {
				return;
			}
			painted.add(key);
			addWreath(square, tint, scale);
		};
		for (const square of destinations) {
			paint(square, palette.quietFill, 1);
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
					paint(between, palette.captureFill, wreathSprites.captureScale);
				}
			}
		}
	}

	function layoutBoard(width: number, height: number): void {
		ground.setPosition(0, 0);
		ground.setSize(width, height);
		const field = computeFieldLayout(width, height);
		const fieldSize = field.fieldSize;
		const cell = fieldSize / layout.rankCount;
		ground.setTileScale(cell / tableLayers.tile, cell / tableLayers.tile);
		originX = field.originX;
		originY = field.originY;
		cellW = fieldSize / layout.rankCount;
		cellH = fieldSize / layout.rankCount;
		for (const pit of pits) {
			const box = cellBox(pit.square);
			pit.sprite.setPosition(box.x, box.y);
			pit.sprite.setDisplaySize(box.w * layout.pitFit, box.h * layout.pitFit);
		}
		for (const stamp of scorches) {
			placeScorch(stamp.sprite, stamp.square);
		}
		for (const fx of captureVfx) {
			placeCaptureSprite(fx.sprite, fx.square);
		}
		for (const speck of debris) {
			const box = cellBox(speck.square);
			const cellPx = Math.min(box.w, box.h);
			speck.sprite.setPosition(box.x, box.y);
			speck.sprite.setDisplaySize(cellPx * speck.fitW, cellPx * speck.fitH);
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
			stopPulse(pulsing, Boolean(next));
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

	scene.tweens.setLagSmooth(40, 16);

	function hopProgress(tween: Phaser.Tweens.Tween): number {
		const duration = tween.duration > 0 ? tween.duration : layout.moveMs;
		return Math.min(1, Math.max(0, tween.elapsed / duration));
	}

	function playMove(
		move: IMove,
		onDone: () => void,
		onLand?: (took: boolean) => void,
		onTakeoff?: () => void,
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
			const landBox = cellBox(land);
			placeFxAt(landBox.x, landBox.y, landBox.w, landBox.h);
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
			const fly = (): void => {
				onTakeoff?.();
				flashGhost(view);
				playFireStreak();
				view.sprite.setScale(view.baseScale);
				view.sprite.setPosition(fromBox.x, fromBox.y);
				const arc = Math.min(fromBox.w, fromBox.h) * layout.hopArcRatio;
				const spanX = box.x - fromBox.x;
				const spanY = box.y - fromBox.y;
				hopBack = Math.atan2(spanX, -spanY) + Math.PI;
				const carrier = scene.add.container(fromBox.x, fromBox.y);
				carrier.setDepth(6);
				showTongues();
				stopTongueWobble();
				for (const tongue of tongues) {
					carrier.add(tongue.sprite);
				}
				layoutTongues(0, 0, view.sprite.displayWidth, 'up', hopBack);
				carrier.add(view.sprite);
				view.sprite.setPosition(0, 0);
				const landHop = (): void => {
					carrier.remove(view.sprite);
					for (const tongue of tongues) {
						carrier.remove(tongue.sprite);
						tongue.sprite.setDepth(2.7);
					}
					view.sprite.setPosition(box.x, box.y);
					view.sprite.setScale(view.baseScale);
					view.sprite.setDepth(6);
					hopBack = null;
					stickFlame(view);
					syncOutline(view);
					carrier.destroy();
					if (capture) {
						captureBetween(from, land);
					}
					onLand?.(capture);
					from = land;
					step(index + 1);
				};
				let struck = false;
				scene.tweens.add({
					targets: carrier,
					x: box.x,
					y: box.y,
					duration: layout.moveMs,
					ease: 'Sine.easeInOut',
					onUpdate: (tween: Phaser.Tweens.Tween) => {
						void hopProgress(tween);
						const t = Math.min(
							1,
							Math.max(
								0,
								Math.abs(spanX) >= Math.abs(spanY)
									? (carrier.x - fromBox.x) / (spanX || 1)
									: (carrier.y - fromBox.y) / (spanY || 1),
							),
						);
						carrier.y = fromBox.y + spanY * t - Math.sin(t * Math.PI) * arc;
						layoutTongues(0, 0, view.sprite.displayWidth, 'up', hopBack);
						followEmitters(view);
						syncOutline(view);
						if (capture && !struck && t >= 0.45) {
							struck = true;
							tween.pause();
							igniteBetween(from, land);
							scene.time.delayedCall(layout.hitStopMs, () => {
								tween.resume();
							});
						}
					},
					onComplete: landHop,
				});
			};
			placeFxAt(fromBox.x, fromBox.y, fromBox.w, fromBox.h);
			stickFlame(view);
			if (index === 0) {
				let flown = false;
				const go = (): void => {
					if (flown) {
						return;
					}
					flown = true;
					fly();
				};
				playFireTakeoff();
				scene.tweens.add({
					targets: view.sprite,
					scaleY: view.baseScale * layout.pressScaleY,
					y: fromBox.y + pressDip(),
					duration: layout.anticipateMs,
					ease: 'Sine.easeIn',
					onUpdate: () => {
						stickFlame(view);
						syncOutline(view);
					},
					onComplete: () => {
						view.sprite.setScale(view.baseScale);
						view.sprite.setPosition(fromBox.x, fromBox.y);
						scene.time.delayedCall(1, go);
					},
				});
			} else {
				fly();
			}
		};
		step(0);
	}

	scene.events.on('update', () => {
		for (const view of pieceViews.values()) {
			syncOutline(view);
		}
	});

	return {
		sync,
		layout: layoutBoard,
		press,
		deny,
		playMove,
		reset: () => {
			pendingLand.clear();
			killCaptureVfx();
			clearScorches();
		},
	};
}
