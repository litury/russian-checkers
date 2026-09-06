import Phaser from 'phaser';
import { hamsterSprites, layout } from '@/client/config/layout';
import type { ISquare } from '@/rules';

type Box = { x: number; y: number; w: number; h: number };

export function attachHamster(
	scene: Phaser.Scene,
	cellBox: (square: ISquare) => Box,
	playfieldOn: () => boolean,
): { layout: () => void; setVisible: (on: boolean) => void } {
	const mound = scene.add
		.image(0, 0, hamsterSprites.emerge[0])
		.setOrigin(0.5)
		.setDepth(6)
		.setVisible(false);
	mound.disableInteractive();
	const body = scene.add
		.image(0, 0, hamsterSprites.emerge[0])
		.setOrigin(0.5)
		.setDepth(6.1)
		.setVisible(false);
	body.disableInteractive();
	let square: ISquare | null = null;
	let cancelled = false;
	const waits: Phaser.Time.TimerEvent[] = [];

	function lightSquares(): ISquare[] {
		const out: ISquare[] = [];
		for (let visRow = 0; visRow < layout.rankCount; visRow += 1) {
			for (let col = 0; col < layout.rankCount; col += 1) {
				if ((visRow + col) % 2 === 1) {
					continue;
				}
				out.push({ row: layout.rankCount - 1 - visRow, col });
			}
		}
		return out;
	}

	function place(): void {
		if (!square) {
			return;
		}
		const box = cellBox(square);
		mound.setPosition(box.x, box.y);
		body.setPosition(box.x, box.y);
		const size = Math.max(box.w, box.h) * 1.2;
		mound.setDisplaySize(size, size);
		body.setDisplaySize(size, size);
	}

	function wait(ms: number, fn: () => void): void {
		waits.push(scene.time.delayedCall(ms, fn));
	}

	function stopWaits(): void {
		for (const t of waits) {
			t.remove(false);
		}
		waits.length = 0;
	}

	function showKeys(keys: string[], hold: number, i: number, done: () => void): void {
		if (cancelled || !playfieldOn()) {
			done();
			return;
		}
		if (i >= keys.length) {
			done();
			return;
		}
		body.setTexture(keys[i]).setFlipX(false).setVisible(true);
		wait(hold, () => showKeys(keys, hold, i + 1, done));
	}

	function cycle(): void {
		if (cancelled || prefersOff() || !playfieldOn()) {
			return;
		}
		const lights = lightSquares();
		const mid = lights.filter(
			(s) => s.row >= 2 && s.row <= 5 && s.col >= 2 && s.col <= 5,
		);
		square =
			(mid.length > 0 ? mid : lights)[
				Math.floor(Math.random() * (mid.length > 0 ? mid.length : lights.length))
			] ?? null;
		if (!square) {
			return;
		}
		place();
		mound.setTexture(hamsterSprites.emerge[0]).setVisible(true);
		const up = [...hamsterSprites.emerge].slice(1);
		showKeys(up, hamsterSprites.holdMs, 0, () => {
			body.setTexture(hamsterSprites.look).setFlipX(false);
			wait(hamsterSprites.lookMs, () => {
				body.setFlipX(true);
				wait(hamsterSprites.lookMs, () => {
					body.setFlipX(false).setTexture(hamsterSprites.scare);
					wait(hamsterSprites.scareMs, () => {
						const down = [...hamsterSprites.emerge].reverse();
						showKeys(down, hamsterSprites.holdMs, 0, () => {
							body.setVisible(false);
							const gap =
								hamsterSprites.gapMinMs +
								Math.floor(
									Math.random() *
										(hamsterSprites.gapMaxMs - hamsterSprites.gapMinMs),
								);
							wait(gap, cycle);
						});
					});
				});
			});
		});
	}

	function prefersOff(): boolean {
		try {
			return Boolean(
				globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
			);
		} catch {
			return false;
		}
	}

	return {
		layout: place,
		setVisible: (on: boolean) => {
			if (!on) {
				cancelled = true;
				stopWaits();
				body.setVisible(false);
				mound.setVisible(false);
				return;
			}
			cancelled = false;
			if (!prefersOff()) {
				stopWaits();
				wait(400, cycle);
			}
		},
	};
}
