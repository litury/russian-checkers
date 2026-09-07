import Phaser from 'phaser';
import { beeSprites, layout } from '@/client/config/layout';
import type { ISquare } from '@/rules';

type Box = { x: number; y: number; w: number; h: number };
type Bounds = { originX: number; originY: number; cellW: number; cellH: number };

export function attachBeeFlower(
	scene: Phaser.Scene,
	cellBox: (square: ISquare) => Box,
	boundsOf: () => Bounds,
	playfieldOn: () => boolean,
): { layout: () => void; setVisible: (on: boolean) => void; arm: () => void } {
	const flower = scene.add
		.image(0, 0, beeSprites.flower)
		.setOrigin(0.5)
		.setDepth(1.15)
		.setVisible(false);
	flower.disableInteractive();
	const bee = scene.add
		.image(0, 0, beeSprites.fly[0])
		.setOrigin(0.5)
		.setDepth(2.5)
		.setVisible(false);
	bee.disableInteractive();
	let square: ISquare | null = null;
	let cancelled = false;
	let armed = false;
	let flap = 0;
	const waits: Phaser.Time.TimerEvent[] = [];
	let tween: Phaser.Tweens.Tween | null = null;

	function pickFlower(): void {
		square = { row: layout.rankCount - 1 - 2, col: 4 };
	}

	function fit(sprite: Phaser.GameObjects.Image, at: ISquare, scale: number): void {
		const box = cellBox(at);
		const size = Math.min(box.w, box.h) * scale;
		sprite.setPosition(box.x, box.y);
		sprite.setDisplaySize(size, size);
	}

	function place(): void {
		if (!square) {
			pickFlower();
		}
		if (!square) {
			return;
		}
		fit(flower, square, beeSprites.flowerScale);
		if (bee.visible && bee.texture.key === beeSprites.sit) {
			fit(bee, square, beeSprites.beeScale);
		}
	}

	function stopMotion(): void {
		for (const t of waits) {
			t.remove(false);
		}
		waits.length = 0;
		tween?.stop();
		tween = null;
	}

	function wait(ms: number, fn: () => void): void {
		waits.push(scene.time.delayedCall(ms, fn));
	}

	function flapWings(): void {
		if (cancelled || !playfieldOn() || !bee.visible) {
			return;
		}
		if (bee.texture.key === beeSprites.sit) {
			return;
		}
		flap = 1 - flap;
		bee.setTexture(beeSprites.fly[flap]);
		wait(beeSprites.flapMs, flapWings);
	}

	function cycle(): void {
		if (cancelled || !armed || !playfieldOn() || !square) {
			return;
		}
		const box = cellBox(square);
		const b = boundsOf();
		const fromLeft = Math.random() < 0.5;
		const startX = fromLeft
			? b.originX - b.cellW
			: b.originX + layout.rankCount * b.cellW + b.cellW;
		const endX = fromLeft
			? b.originX + layout.rankCount * b.cellW + b.cellW
			: b.originX - b.cellW;
		bee.setFlipX(!fromLeft);
		bee.setTexture(beeSprites.fly[0]);
		bee.setAlpha(1);
		bee.setPosition(startX, box.y);
		const size = Math.min(box.w, box.h) * beeSprites.beeScale;
		bee.setDisplaySize(size, size);
		bee.setVisible(true);
		flapWings();
		const inMs = Math.max(900, Math.abs(box.x - startX) * beeSprites.msPerPx);
		tween = scene.tweens.add({
			targets: bee,
			x: box.x,
			y: box.y,
			duration: inMs,
			ease: 'Sine.easeInOut',
			onComplete: () => {
				if (cancelled || !playfieldOn() || !square) {
					return;
				}
				bee.setTexture(beeSprites.sit);
				fit(bee, square, beeSprites.beeScale);
				wait(beeSprites.sitMs, () => {
					if (cancelled || !playfieldOn()) {
						return;
					}
					bee.setTexture(beeSprites.fly[0]);
					flapWings();
					const outMs = Math.max(900, Math.abs(endX - box.x) * beeSprites.msPerPx);
					tween = scene.tweens.add({
						targets: bee,
						x: endX,
						alpha: 0,
						duration: outMs,
						ease: 'Sine.easeIn',
						onComplete: () => {
							bee.setVisible(false);
							bee.setAlpha(1);
							const gap =
								beeSprites.gapMinMs +
								Math.floor(
									Math.random() * (beeSprites.gapMaxMs - beeSprites.gapMinMs),
								);
							wait(gap, cycle);
						},
					});
				});
			},
		});
	}

	return {
		layout: place,
		arm: () => {
			if (armed) {
				return;
			}
			armed = true;
			cancelled = false;
			stopMotion();
			place();
			flower.setVisible(playfieldOn());
			wait(600, cycle);
		},
		setVisible: (on: boolean) => {
			if (!on) {
				cancelled = true;
				armed = false;
				stopMotion();
				bee.setVisible(false);
				flower.setVisible(false);
				return;
			}
			cancelled = false;
			if (square) {
				flower.setVisible(true);
			}
		},
	};
}
