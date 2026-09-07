import Phaser from 'phaser';
import { rabbitSprites, layout } from '@/client/config/layout';

type Bounds = { originX: number; originY: number; cellW: number; cellH: number };

export function attachRabbit(
	scene: Phaser.Scene,
	boundsOf: () => Bounds,
	playfieldOn: () => boolean,
): { layout: () => void; setVisible: (on: boolean) => void; arm: () => void } {
	const body = scene.add
		.image(0, 0, rabbitSprites.run[0])
		.setOrigin(0.5)
		.setDepth(6.05)
		.setVisible(false);
	body.disableInteractive();
	let cancelled = false;
	let armed = false;
	let goingRight = true;
	let frame = 0;
	const waits: Phaser.Time.TimerEvent[] = [];
	let tween: Phaser.Tweens.Tween | null = null;

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

	function place(): void {
		const b = boundsOf();
		const size = Math.max(b.cellW, b.cellH) * rabbitSprites.bodyScale;
		body.setDisplaySize(size, size * (32 / 48));
	}

	function laneY(): number {
		const b = boundsOf();
		const visRows = [0, 2, 4, 6];
		const visRow = visRows[Math.floor(Math.random() * visRows.length)] ?? 0;
		return b.originY + visRow * b.cellH + b.cellH / 2;
	}

	function stepFrame(): void {
		if (cancelled || !playfieldOn()) {
			return;
		}
		frame = (frame + 1) % rabbitSprites.run.length;
		body.setTexture(rabbitSprites.run[frame]);
		wait(rabbitSprites.holdMs, stepFrame);
	}

	function runAcross(): void {
		if (cancelled || !armed || !playfieldOn()) {
			return;
		}
		const b = boundsOf();
		place();
		const pad = b.cellW * 0.4;
		const left = b.originX + pad;
		const right = b.originX + layout.rankCount * b.cellW - pad;
		const y = laneY();
		const from = goingRight ? left : right;
		const to = goingRight ? right : left;
		body.setPosition(from, y);
		body.setFlipX(!goingRight);
		body.setVisible(true);
		frame = 0;
		body.setTexture(rabbitSprites.run[0]);
		const dist = Math.abs(to - from);
		const ms = Math.max(2200, dist * rabbitSprites.msPerPx);
		tween = scene.tweens.add({
			targets: body,
			x: to,
			duration: ms,
			ease: 'Linear',
			onComplete: () => {
				if (cancelled || !playfieldOn()) {
					return;
				}
				body.setVisible(false);
				goingRight = !goingRight;
				const gap =
					rabbitSprites.gapMinMs +
					Math.floor(Math.random() * (rabbitSprites.gapMaxMs - rabbitSprites.gapMinMs));
				wait(gap, runAcross);
			},
		});
		stepFrame();
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
			wait(800, runAcross);
		},
		setVisible: (on: boolean) => {
			if (!on) {
				cancelled = true;
				armed = false;
				stopMotion();
				body.setVisible(false);
				return;
			}
			cancelled = false;
		},
	};
}
