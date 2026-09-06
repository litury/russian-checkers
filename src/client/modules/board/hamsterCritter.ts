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
		.setOrigin(0.5, 1)
		.setDepth(1.4)
		.setVisible(false);
	mound.disableInteractive();
	const body = scene.add
		.image(0, 0, hamsterSprites.emerge[0])
		.setOrigin(0.5, 1)
		.setDepth(1.5)
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
		const y = box.y + box.h / 2;
		mound.setPosition(box.x, y);
		body.setPosition(box.x, y);
		mound.setDisplaySize(box.w, box.h);
		body.setDisplaySize(box.w, box.h);
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
		square = lights[Math.floor(Math.random() * lights.length)] ?? null;
		if (!square) {
			return;
		}
		place();
		mound.setTexture(hamsterSprites.emerge[0]).setVisible(true);
		const up = [...hamsterSprites.emerge];
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

	if (!prefersOff() && typeof scene.time?.delayedCall === 'function') {
		wait(2500, cycle);
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
				wait(1800, cycle);
			}
		},
	};
}
