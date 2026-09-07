import Phaser from 'phaser';
import { debrisSprites, rabbitSprites, layout } from '@/client/config/layout';

type Bounds = { originX: number; originY: number; cellW: number; cellH: number };

function stoneKeys(): Set<string> {
	const out = new Set<string>();
	for (const stone of debrisSprites.center) {
		const row = layout.rankCount - 1 - stone.visRow;
		out.add(`${row},${stone.col}`);
	}
	return out;
}

export function attachRabbit(
	scene: Phaser.Scene,
	boundsOf: () => Bounds,
	playfieldOn: () => boolean,
): { layout: () => void; setVisible: (on: boolean) => void; arm: () => void } {
	const body = scene.add
		.image(0, 0, rabbitSprites.run[0])
		.setOrigin(0.5)
		.setDepth(2.4)
		.setVisible(false);
	body.disableInteractive();
	let cancelled = false;
	let armed = false;
	let goingRight = true;
	let frame = 0;
	const blocked = stoneKeys();
	const waits: Phaser.Time.TimerEvent[] = [];
	let tween: Phaser.Tweens.Tween | null = null;

	function stopMotion(): void {
		for (const t of waits) {
			t.remove(false);
		}
		waits.length = 0;
		tween?.stop();
		tween = null;
		body.setAlpha(1);
	}

	function wait(ms: number, fn: () => void): void {
		waits.push(scene.time.delayedCall(ms, fn));
	}

	function place(): void {
		const b = boundsOf();
		const size = Math.max(b.cellW, b.cellH) * rabbitSprites.bodyScale;
		body.setDisplaySize(size, size * (32 / 48));
	}

	function grassPath(): { x: number; y: number }[] {
		const b = boundsOf();
		const n = layout.rankCount;
		const bands = [0, 2, 4, 6];
		const band = bands[Math.floor(Math.random() * bands.length)] ?? 0;
		const out: { x: number; y: number }[] = [];
		for (let col = 0; col < n; col += 1) {
			const visRow = col % 2 === 0 ? band : band + 1;
			const row = n - 1 - visRow;
			if (blocked.has(`${row},${col}`)) {
				continue;
			}
			out.push({
				x: b.originX + col * b.cellW + b.cellW / 2,
				y: b.originY + visRow * b.cellH + b.cellH / 2,
			});
		}
		return goingRight ? out : [...out].reverse();
	}

	function stepFrame(): void {
		if (cancelled || !playfieldOn()) {
			return;
		}
		frame = (frame + 1) % rabbitSprites.run.length;
		body.setTexture(rabbitSprites.run[frame]);
		wait(rabbitSprites.holdMs, stepFrame);
	}

	function hop(path: { x: number; y: number }[], i: number): void {
		if (cancelled || !armed || !playfieldOn()) {
			return;
		}
		if (i >= path.length) {
			goingRight = !goingRight;
			const gap =
				rabbitSprites.gapMinMs +
				Math.floor(Math.random() * (rabbitSprites.gapMaxMs - rabbitSprites.gapMinMs));
			wait(gap, runAcross);
			return;
		}
		const next = path[i];
		const last = i === path.length - 1;
		const dist = Phaser.Math.Distance.Between(body.x, body.y, next.x, next.y);
		const ms = Math.max(180, dist * rabbitSprites.msPerPx);
		tween = scene.tweens.add({
			targets: body,
			x: next.x,
			y: next.y,
			alpha: last ? 0 : 1,
			duration: last ? Math.max(ms, 280) : ms,
			ease: 'Linear',
			onComplete: () => {
				if (last) {
					body.setVisible(false);
					body.setAlpha(1);
				}
				hop(path, i + 1);
			},
		});
	}

	function runAcross(): void {
		if (cancelled || !armed || !playfieldOn()) {
			return;
		}
		place();
		const path = grassPath();
		if (path.length < 2) {
			wait(1000, runAcross);
			return;
		}
		body.setPosition(path[0].x, path[0].y);
		body.setFlipX(!goingRight);
		body.setAlpha(0);
		body.setVisible(true);
		frame = 0;
		body.setTexture(rabbitSprites.run[0]);
		scene.tweens.add({
			targets: body,
			alpha: 1,
			duration: 220,
			ease: 'Linear',
		});
		hop(path, 1);
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
