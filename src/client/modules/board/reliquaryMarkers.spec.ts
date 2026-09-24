import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import {
	ARROW_NATURAL,
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
