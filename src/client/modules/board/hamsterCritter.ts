import Phaser from 'phaser';
import { debrisSprites, hamsterSprites, layout } from '@/client/config/layout';
import type { ISquare } from '@/rules';

type Box = { x: number; y: number; w: number; h: number };

function stoneKeys(): Set<string> {
	const out = new Set<string>();
	for (const stone of debrisSprites.center) {
		const row = layout.rankCount - 1 - stone.visRow;
		out.add(`${row},${stone.col}`);
	}
	return out;
}

export function attachHamster(
	scene: Phaser.Scene,
	cellBox: (square: ISquare) => Box,
	playfieldOn: () => boolean,
): { layout: () => void; setVisible: (on: boolean) => void; arm: () => void } {
	const hole = scene.add
		.image(0, 0, hamsterSprites.hole)
		.setOrigin(0.5)
		.setDepth(6)
		.setVisible(false);
	hole.disableInteractive();
	const body = scene.add
		.image(0, 0, hamsterSprites.look)
		.setOrigin(0.5)
		.setDepth(6.1)
		.setVisible(false);
	body.disableInteractive();
	let square: ISquare | null = null;
	let cancelled = false;
	let armed = false;
	const blocked = stoneKeys();
	const waits: Phaser.Time.TimerEvent[] = [];

	function spawnSquares(): ISquare[] {
		const out: ISquare[] = [];
		for (let visRow = 0; visRow < layout.rankCount; visRow += 1) {
			for (let col = 0; col < layout.rankCount; col += 1) {
				if ((visRow + col) % 2 === 1) {
					continue;
				}
				const row = layout.rankCount - 1 - visRow;
				if (blocked.has(`${row},${col}`)) {
					continue;
				}
				out.push({ row, col });
			}
		}
		return out;
	}

	function fit(sprite: Phaser.GameObjects.Image, at: ISquare, scale: number): void {
		const box = cellBox(at);
		const size = Math.max(box.w, box.h) * scale;
		sprite.setPosition(box.x, box.y);
		sprite.setDisplaySize(size, size);
	}

	function place(): void {
		if (!square) {
			return;
		}
		fit(hole, square, hamsterSprites.holeScale);
		fit(body, square, hamsterSprites.bodyScale);
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
		if (cancelled || !armed || !playfieldOn()) {
			return;
		}
		const spots = spawnSquares();
		square = spots[Math.floor(Math.random() * spots.length)] ?? null;
		if (!square) {
			return;
		}
		place();
		hole.setVisible(true);
		body.setVisible(false);
		const up = [...hamsterSprites.emerge];
		const down = [...up].reverse();
		showKeys(up, hamsterSprites.holdMs, 0, () => {
			body.setTexture(hamsterSprites.look).setFlipX(false).setVisible(true);
			wait(hamsterSprites.lookMs, () => {
				body.setFlipX(true);
				wait(hamsterSprites.lookMs, () => {
					body.setFlipX(false).setTexture(hamsterSprites.scare);
					wait(hamsterSprites.scareMs, () => {
						showKeys(down, hamsterSprites.holdMs, 0, () => {
							body.setVisible(false);
							hole.setVisible(false);
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

	return {
		layout: place,
		arm: () => {
			if (armed) {
				return;
			}
			armed = true;
			cancelled = false;
			stopWaits();
			wait(300, cycle);
		},
		setVisible: (on: boolean) => {
			if (!on) {
				cancelled = true;
				armed = false;
				stopWaits();
				body.setVisible(false);
				hole.setVisible(false);
				return;
			}
			cancelled = false;
		},
	};
}
