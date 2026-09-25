import type Phaser from 'phaser';
import type { ISquare, Side } from '@/rules';

export type Marker =
	| 'available'
	| 'selected'
	| 'move'
	| 'landing'
	| 'futureLanding'
	| 'target'
	| 'focus'
	| 'hover';

/** Cropped parent staple sheet: four corners in a 176px cell, shown at the live cell size. */
export const MARKER_STAPLES = 'marker_staples';
export const MARKER_STAPLES_AMBER = 'marker_staples_amber';
export const MARKER_STAPLES_COPPER = 'marker_staples_copper';
export const MARKER_ARROW_AMBER = 'marker_arrow_amber';
export const MARKER_ARROW_COPPER = 'marker_arrow_copper';
/** One slash for every capture. Rotated to the hop; the piece texture is not redrawn. */
export const MARKER_CUT = 'marker_cut';
export const STAPLE_SOURCE_PX = 176;
/** arrow.png size. Long side is drawn at ARROW_CELL of the live cell. */
export const ARROW_TEXTURE = { w: 194, h: 183 } as const;
export const ARROW_CELL = 0.38;
/** Center sits just outside the cell corner so the tip does not cover the face. */
export const ARROW_CORNER = 0.55;
/**
 * Direction of the ivory tip in arrow.png, measured from the image center.
 * Screen y grows downward. The authored arrow points down-right.
 */
export const ARROW_NATURAL = Math.atan2(132 - 91.5, 160 - 97);

/** Screen step of a rules diagonal. Columns do not flip; only the vertical does. */
export function screenStep(
	from: ISquare,
	to: ISquare,
	facing: Side,
): { dx: number; dy: number } {
	const dx = Math.sign(to.col - from.col);
	const dr = Math.sign(to.row - from.row);
	return { dx, dy: facing === 'black' ? dr : -dr };
}

/** Rotation that aims the one authored arrow along a screen diagonal. */
export function arrowRotation(dx: number, dy: number): number {
	return Math.atan2(dy, dx) - ARROW_NATURAL;
}

/**
 * Keyboard focus only. Corner brackets and the move arrow are sprites.
 * Do not paint a vector circle or a plate. Do not tint a whole PNG:
 * the dark sole would change colour with the metal.
 */
export function drawReliquaryMarker(
	g: Phaser.GameObjects.Graphics,
	box: { x: number; y: number; w: number; h: number },
	state: Marker,
	_elapsed = 720,
	_opacity = 1,
): void {
	if (state !== 'focus') return;
	const u = Math.min(box.w, box.h) / 44;
	const stroke = (points: number[][]): void => {
		g.lineStyle((1.7 + 1.8) * u, 0x101619, 1);
		g.beginPath();
		points.forEach(([x, y], i) => {
			const px = box.x - box.w / 2 + x * u;
			const py = box.y - box.h / 2 + y * u;
			if (i === 0) g.moveTo(px, py);
			else g.lineTo(px, py);
		});
		g.strokePath();
		g.lineStyle(1.7 * u, 0xeee4ca, 1);
		g.beginPath();
		points.forEach(([x, y], i) => {
			const px = box.x - box.w / 2 + x * u;
			const py = box.y - box.h / 2 + y * u;
			if (i === 0) g.moveTo(px, py);
			else g.lineTo(px, py);
		});
		g.strokePath();
	};
	for (let a = 3; a < 40; a += 7) {
		const b = Math.min(a + 3, 41);
		for (const pts of [
			[
				[a, 2],
				[b, 2],
			],
			[
				[a, 42],
				[b, 42],
			],
			[
				[2, a],
				[2, b],
			],
			[
				[42, a],
				[42, b],
			],
		])
			stroke(pts);
	}
}
