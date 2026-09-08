import Phaser from 'phaser';
import {
	clockHudLayout,
	computeFieldLayout,
	hudClockEH,
	hudClockEW,
} from '@/client/config/fieldLayout';
import { beeSprites } from '@/client/config/layout';

type Spot = { x: number; y: number; size: number };

export function attachBeeFlower(
	scene: Phaser.Scene,
	playfieldOn: () => boolean,
): { layout: () => void; setVisible: (on: boolean) => void; arm: () => void } {
	const flower = scene.add
		.image(0, 0, beeSprites.flower)
		.setOrigin(0.5)
		.setDepth(11)
		.setVisible(false);
	flower.disableInteractive();
	const bee = scene.add
		.image(0, 0, beeSprites.fly[0])
		.setOrigin(0.5)
		.setDepth(12.5)
		.setVisible(false);
	bee.disableInteractive();
	let cancelled = false;
	let armed = false;
	let flap = 0;
	let deskSide: 'foe' | 'you' | null = null;
	const waits: Phaser.Time.TimerEvent[] = [];
	let tween: Phaser.Tweens.Tween | null = null;

	function spot(): Spot {
		const width = scene.scale.width;
		const height = scene.scale.height;
		const field = computeFieldLayout(width, height);
		const clocks = clockHudLayout(width, height, field);
		const size = Math.max(28, field.cell * beeSprites.flowerScale);
		if (field.portrait) {
			const foeCx = clocks.foe.x + hudClockEW / 2;
			const youCx = clocks.you.x - hudClockEW / 2;
			return {
				x: (foeCx + youCx) / 2,
				y: clocks.foe.y - hudClockEH * 0.42,
				size,
			};
		}
		if (deskSide !== 'foe' && deskSide !== 'you') {
			deskSide = Math.random() < 0.5 ? 'foe' : 'you';
		}
		const pick = deskSide === 'foe' ? clocks.foe : clocks.you;
		const left = pick.x - pick.originX * hudClockEW;
		const top = pick.y - pick.originY * hudClockEH;
		return {
			x: left + hudClockEW / 2,
			y: top - size * 0.55,
			size,
		};
	}

	function place(): void {
		const at = spot();
		flower.setPosition(at.x, at.y);
		flower.setDisplaySize(at.size, at.size);
		if (bee.visible && bee.texture.key === beeSprites.sit) {
			const beeSize = at.size * (beeSprites.beeScale / beeSprites.flowerScale);
			bee.setPosition(at.x, at.y);
			bee.setDisplaySize(beeSize, beeSize);
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
		if (cancelled || !armed || !playfieldOn()) {
			return;
		}
		const at = spot();
		const field = computeFieldLayout(scene.scale.width, scene.scale.height);
		const fromLeft = Math.random() < 0.5;
		const startX = fromLeft ? -field.cell : scene.scale.width + field.cell;
		const endX = fromLeft ? scene.scale.width + field.cell : -field.cell;
		const beeSize = at.size * (beeSprites.beeScale / beeSprites.flowerScale);
		bee.setFlipX(!fromLeft);
		bee.setTexture(beeSprites.fly[0]);
		bee.setAlpha(1);
		bee.setPosition(startX, at.y);
		bee.setDisplaySize(beeSize, beeSize);
		bee.setVisible(true);
		flapWings();
		const inMs = Math.max(900, Math.abs(at.x - startX) * beeSprites.msPerPx);
		tween = scene.tweens.add({
			targets: bee,
			x: at.x,
			y: at.y,
			duration: inMs,
			ease: 'Sine.easeInOut',
			onComplete: () => {
				if (cancelled || !playfieldOn()) {
					return;
				}
				bee.setTexture(beeSprites.sit);
				bee.setPosition(at.x, at.y);
				wait(beeSprites.sitMs, () => {
					if (cancelled || !playfieldOn()) {
						return;
					}
					bee.setTexture(beeSprites.fly[0]);
					flapWings();
					const outMs = Math.max(900, Math.abs(endX - at.x) * beeSprites.msPerPx);
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
			deskSide = null;
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
			flower.setVisible(true);
		},
	};
}
