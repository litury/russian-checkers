import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import {
	ARROW_CELL,
	ARROW_INSET,
	ARROW_NATURAL,
	ARROW_TEXTURE,
	arrowRotation,
	drawReliquaryMarker,
	screenStep,
} from './reliquaryMarkers';

function strokes(state: Parameters<typeof drawReliquaryMarker>[2]) {
	const result: { color: number; points: number[][] }[] = [];
	let color = 0;
	let points: number[][] = [];
	const g = {
		lineStyle: (_w: number, c: number) => {
			color = c;
		},
		beginPath: () => {
			points = [];
		},
		moveTo: (x: number, y: number) => points.push([x, y]),
		lineTo: (x: number, y: number) => points.push([x, y]),
		fillStyle: () => {},
		fillEllipse: () => {
			throw new Error('destination circle');
		},
		strokePath: () => result.push({ color, points }),
	} as unknown as Phaser.GameObjects.Graphics;
	drawReliquaryMarker(g, { x: 22, y: 22, w: 44, h: 44 }, state);
	return result;
}

describe('sprite markers replace vector staples and circles', () => {
	it('draws no vector staple, circle, or hover', () => {
		for (const state of ['available', 'selected', 'target', 'move', 'landing', 'futureLanding', 'hover'] as const)
			expect(strokes(state)).toEqual([]);
	});
	it('keeps the keyboard focus dashes, not a ring', () => {
		const focus = strokes('focus');
		expect(focus.length).toBeGreaterThan(8);
		expect(focus.every(s => s.points.length === 2)).toBe(true);
		expect(focus.some(s => s.color === 0xeee4ca)).toBe(true);
	});
	it('rotates the one arrow by a right angle on each legal screen diagonal', () => {
		const dirs = [[1, 1], [-1, 1], [-1, -1], [1, -1]] as const;
		const angles = dirs.map(([dx, dy]) => arrowRotation(dx, dy));
		expect(new Set(angles.map(a => Math.round(a * 1e6))).size).toBe(4);
		for (let i = 0; i < 4; i++) {
			const turn = angles[(i + 1) % 4] - angles[i];
			const wrapped = Math.atan2(Math.sin(turn), Math.cos(turn));
			expect(Math.abs(Math.abs(wrapped) - Math.PI / 2)).toBeLessThan(1e-9);
		}
		expect(arrowRotation(1, 1)).toBeCloseTo(Math.atan2(1, 1) - ARROW_NATURAL);
	});
	it('flips only the vertical when the player faces black', () => {
		const from = { row: 2, col: 2 };
		const to = { row: 3, col: 3 };
		expect(screenStep(from, to, 'white')).toEqual({ dx: 1, dy: -1 });
		expect(screenStep(from, to, 'black')).toEqual({ dx: 1, dy: 1 });
	});
});

/**
 * The corner bracket geometry, measured on markers/staples.png: one 176px cell
 * holds four L-shaped brackets. Relative to a cell corner each bracket is two
 * arms - a 3..50 x 4..22 strip along one edge and a 3..24 x 4..46 strip along the
 * other, in sheet pixels.
 */
const STAPLE_PX = 176;
const BRACKET_ARMS = [
	{ x0: 3, x1: 50, y0: 4, y1: 22 },
	{ x0: 3, x1: 24, y0: 4, y1: 46 },
];

type Pt = { x: number; y: number };

function pointSegment(p: Pt, a: Pt, b: Pt): number {
	const vx = b.x - a.x;
	const vy = b.y - a.y;
	const len2 = vx * vx + vy * vy;
	const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / len2));
	return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy));
}

function segmentDistance(a: Pt, b: Pt, c: Pt, d: Pt): number {
	const cross = (o: Pt, p: Pt, q: Pt) => (p.x - o.x) * (q.y - o.y) - (p.y - o.y) * (q.x - o.x);
	const d1 = cross(c, d, a);
	const d2 = cross(c, d, b);
	const d3 = cross(a, b, c);
	const d4 = cross(a, b, d);
	if ((d1 > 0) !== (d2 > 0) && (d3 > 0) !== (d4 > 0)) return 0;
	return Math.min(pointSegment(a, c, d), pointSegment(b, c, d), pointSegment(c, a, b), pointSegment(d, a, b));
}

/** The arrow texture is a filled rectangle turned onto the screen diagonal. */
function arrowRect(cell: number, dx: number, dy: number, reach = 1 - ARROW_INSET): Pt[] {
	const scale = (cell * ARROW_CELL) / Math.max(ARROW_TEXTURE.w, ARROW_TEXTURE.h);
	const w = ARROW_TEXTURE.w * scale;
	const h = ARROW_TEXTURE.h * scale;
	const rot = arrowRotation(dx, dy);
	const cos = Math.cos(rot);
	const sin = Math.sin(rot);
	const cx = dx * reach * cell;
	const cy = dy * reach * cell;
	return [
		[-1, -1],
		[1, -1],
		[1, 1],
		[-1, 1],
	].map(([sx, sy]) => {
		const px = (sx * w) / 2;
		const py = (sy * h) / 2;
		return { x: cx + px * cos - py * sin, y: cy + px * sin + py * cos };
	});
}

describe('move arrow stays off the corner brackets', () => {
	const cell = 100;
	const dirs = [
		[1, 1],
		[1, -1],
		[-1, 1],
		[-1, -1],
	] as const;

	it('sits inside the destination cell, not on the shared corner', () => {
		expect(ARROW_INSET).toBeGreaterThan(0);
		expect(ARROW_INSET).toBeLessThan(0.5);
		expect(1 - ARROW_INSET).toBeGreaterThan(0.5);
	});

	it('keeps a visible gap to every bracket of the destination cell', () => {
		for (const [dx, dy] of dirs) {
			const rect = arrowRect(cell, dx, dy);
			const corner = { x: dx * 0.5 * cell, y: dy * 0.5 * cell };
			let closest = Number.POSITIVE_INFINITY;
			for (const arm of BRACKET_ARMS) {
				const quad = [
					{ x: corner.x + (dx * arm.x0 * cell) / STAPLE_PX, y: corner.y + (dy * arm.y0 * cell) / STAPLE_PX },
					{ x: corner.x + (dx * arm.x1 * cell) / STAPLE_PX, y: corner.y + (dy * arm.y0 * cell) / STAPLE_PX },
					{ x: corner.x + (dx * arm.x1 * cell) / STAPLE_PX, y: corner.y + (dy * arm.y1 * cell) / STAPLE_PX },
					{ x: corner.x + (dx * arm.x0 * cell) / STAPLE_PX, y: corner.y + (dy * arm.y1 * cell) / STAPLE_PX },
				];
				for (let i = 0; i < 4; i++)
					for (let j = 0; j < 4; j++)
						closest = Math.min(
							closest,
							segmentDistance(rect[i], rect[(i + 1) % 4], quad[j], quad[(j + 1) % 4]),
						);
			}
			// The modelled rectangle is the widest possible ink of the arrow, so the
			// real chevron keeps at least this gap. The bound is the measured raster
			// gap of the authored arrow minus the modelled slack.
			expect(closest).toBeGreaterThan(0.04 * cell);
		}
	});
});
